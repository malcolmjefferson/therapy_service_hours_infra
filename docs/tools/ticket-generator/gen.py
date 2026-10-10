import re, csv, json, sys, collections, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import tickets_a, tickets_b, tickets_c
DOCS=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))
rows=tickets_a.T+tickets_b.T+tickets_c.T
FIELDS=['id','type','summary','desc','ac','est','deps','reqs','us','labels','pri']
tk=[]
for r in rows:
    d=dict(zip(FIELDS,r))
    d['ac']=d['ac'].split('|'); d['deps']=[x for x in d['deps'].split(',') if x]
    d['reqs']=[x for x in d['reqs'].split(',') if x]; d['us']=[x for x in d['us'].split(',') if x]
    d['labels']=d['labels'].split(','); d['slice']=d['id'].split('-')[0]
    tk.append(d)
by={d['id']:d for d in tk}
SL={
'S0':('Walking skeleton','Prove the whole delivery path with the smallest possible feature: a page served by CloudFront calls the API, which reads the database, deployed to dev and prod by one pipeline.','M1','Open the dev and prod URLs: the Status page shows the API version and database check. Break a lint rule, a test or a migration on purpose: the pipeline stops before prod and an email arrives.'),
'S1':('Secure sign-in','Invite-only Google sign-in with roles, the first admin, and the authorization framework every later slice uses.','M2','An invited Google account signs in and sees its name and role-based navigation; an uninvited account is refused; a deactivated account is refused.'),
'S2':('Log hours','The core product for one user: log sessions with start and end times, save clients, and browse them in the entries table.','M3','Sign in, add clients, log entries (including an overlap attempt that is blocked), sort, filter, edit, delete.'),
'S3':('Goals and progress','Goal cards with ruler-style progress bars, editable targets, and the approved/pending/rejected rules.','M3','Goal bars reflect logged hours; changing a target updates the bar; pending hours show as a lighter segment.'),
'S4':('Import and export','Bring in the prototype ledger (marked Needs time) and take data out as Markdown, CSV and PDF.','M3','Import a prototype file and see the report; export all three formats; re-import the Markdown export with identical results.'),
'S5':('Organizations and admin console','Admins manage organizations, users, roles, email changes, deactivation and deletion, with an audit log.','M4','As admin: create an organization, invite a user, grant Supervisor, change an email, deactivate and permanently delete; non-admins are refused.'),
'S6':('Supervision and notifications','Find a supervisor in the same organization, request, accept or decline, end a link, and see in-app notifications.','M4','A trainee requests a supervisor; the supervisor sees the badge, accepts; both see the right state; cross-organization attempts fail.'),
'S7':('Review workflow','Approve, reject (reason), bulk approve, revert (reason), history, locking, and approved-hours-driven progress.','M5','A supervisor approves, rejects and reverts entries; the trainee sees chips and reasons; goal bars follow approved hours.'),
'S8':('Supervisor dashboard','Pick a supervisee, see per-goal progress, pending and rejected counts, and drill into entries to act.','M5','A supervisor sees accurate summaries for accepted supervisees only and reviews from the drill-down.'),
'S9':('Milestone celebrations','One-time celebration banners and confetti at 25/50/75/100% of approved hours.','M5','Approving hours past 25% celebrates once; reload and revert-then-reapprove never replay.'),
'S10':('Team schedules','Read-only Monday to Friday schedules for peers with the same supervisor, showing only time and category.','M6','Two peers see each other\'s week blocks; no client, notes, hours, on-site or status ever appears; non-peers are refused.'),
'S11':('Hardening and go-live','Security suites, performance, accessibility, restore drill, cost check, runbook, user guide and the production release.','M6','All gates green on dev; runbook and user guide done; owner approves prod.'),
}
order=['S%d'%i for i in range(12)]
# ---------- validation ----------
errs=[]
ids=[d['id'] for d in tk]
if len(ids)!=len(set(ids)): errs.append('duplicate ids')
for d in tk:
    if d['est']>2: errs.append(f"{d['id']} est>2")
    for x in d['deps']:
        if x not in by: errs.append(f"{d['id']} unknown dep {x}")
        elif int(by[x]['slice'][1:])>int(d['slice'][1:]): errs.append(f"{d['id']} depends on later slice {x}")
    if len(d['ac'])<2: errs.append(f"{d['id']} <2 AC")
# cycle / topo + earliest finish (critical path)
ef={}
def fin(i,stack=()):
    if i in stack: errs.append('cycle '+i); return 0
    if i in ef: return ef[i]
    d=by[i]; s=max([fin(x,stack+(i,)) for x in d['deps']] or [0]); ef[i]=s+d['est']; return ef[i]
for i in ids: fin(i)
# requirement/story id universes from docs
r1=open(DOCS+'/01-requirements-specification.md').read()
r3=open(DOCS+'/03-user-stories.md').read()
fr=sorted(set(re.findall(r'^\| ((?:FR|NFR)-[A-Z0-9]+-\d+) \|',r1,re.M)))
us=sorted(set(re.findall(r'^\| (US-\d+) \|',r3,re.M)))
cov_fr=collections.defaultdict(list); cov_us=collections.defaultdict(list)
for d in tk:
    for x in d['reqs']:
        if x not in fr: errs.append(f"{d['id']} unknown req {x}")
        cov_fr[x].append(d['id'])
    for x in d['us']:
        if x not in us: errs.append(f"{d['id']} unknown story {x}")
        cov_us[x].append(d['id'])
unc_fr=[x for x in fr if x not in cov_fr]; unc_us=[x for x in us if x not in cov_us]
blocks=collections.defaultdict(list)
for d in tk:
    for x in d['deps']: blocks[x].append(d['id'])
print('tickets',len(tk),'FR/NFR',len(fr),'US',len(us))
print('errors',errs); print('uncovered FR',unc_fr); print('uncovered US',unc_us)
# ---------- stats ----------
stats={}
for s in order:
    ts=[d for d in tk if d['slice']==s]
    stats[s]=dict(n=len(ts),days=sum(d['est'] for d in ts))
tot=sum(v['days'] for v in stats.values())
cp=max(ef.values())
print(stats,tot,'critical path days',cp)
json.dump(dict(stats=stats,total=tot,cp=cp,n=len(tk),fr=len(fr),us=len(us)),open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'stats.json'),'w'))
if errs or unc_fr or unc_us:
    if '--write' not in sys.argv: sys.exit(1)
if '--write' not in sys.argv: sys.exit(0)
# ---------- write per-slice files ----------
pts={0.5:1,1:2,1.5:3,2:5}
slug=lambda s:re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
files={}
for s in order:
    name,goal,ms,demo=SL[s]; ts=[d for d in tk if d['slice']==s]
    fn=f"{s}-{slug(name)}.md"; files[s]=fn
    o=[f"# {s}: {name}\n",f"> **Milestone:** {ms} · **Tickets:** {len(ts)} · **Estimate:** {stats[s]['days']:g} developer-days\n",
       f"## Slice goal\n{goal}\n",f"## Demo / acceptance of the slice\n{demo}\n",
       "## Slice Definition of Done\n- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`\n- [ ] OpenAPI changed first and the frontend drift gate is green\n- [ ] Automated tests for the slice pass in the pipeline on dev\n- [ ] The demo above is performed on dev by someone other than the author, or recorded\n- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)\n",
       "## Ticket index\n","| ID | Type | Summary | Est (d) | Blocked by |","|---|---|---|--:|---|"]
    for d in ts: o.append(f"| [{d['id']}](#{d['id'].lower()}) | {d['type']} | {d['summary']} | {d['est']:g} | {', '.join(d['deps']) or '-'} |")
    o.append("")
    for d in ts:
        o+= [f"---\n\n### {d['id']}",f"**{d['summary']}**\n",
        "| Field | Value |","|---|---|",
        f"| Issue Type | {d['type']} |",f"| Epic | EPIC-{s} {name} |",f"| Priority | {d['pri']} |",
        f"| Estimate | {d['est']:g} day(s) · {pts[d['est']]} points |",f"| Labels | {', '.join(d['labels'])} |",
        f"| Requirements | {', '.join(d['reqs'])} |",f"| Stories | {', '.join(d['us'])} |",
        f"| Is blocked by | {', '.join(d['deps']) or '-'} |",f"| Blocks | {', '.join(blocks.get(d['id'],[])) or '-'} |","",
        "**Description**\n",d['desc']+"\n","**Acceptance criteria**\n"]
        o+= [f"- [ ] {a}" for a in d['ac']]
        o+= ["","**Definition of Done**\n","- [ ] Implementation merged\n- [ ] Validation: automated tests (and manual steps where noted) pass\n- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed\n"]
    open(f"{DOCS}/jira/{fn}",'w').write("\n".join(o))
# ---------- CSV ----------
epic_id={s:i+1 for i,s in enumerate(order)}
num={d['id']:len(order)+i+1 for i,d in enumerate(tk)}
maxl=max(len(d['labels']) for d in tk); maxb=max(len(v) for v in blocks.values())
with open(f"{DOCS}/jira/tickets.csv",'w',newline='') as f:
    w=csv.writer(f)
    w.writerow(['Issue Id','Issue Type','Summary','Description','Priority','Parent Id']+['Labels']*(maxl+1)+['Original Estimate','Story Points','Draft ID']+['Outward issue link (Blocks)']*maxb)
    for s in order:
        name,goal,ms,demo=SL[s]
        w.writerow([epic_id[s],'Epic',f"{s} {name}",f"{goal}\n\nDemo: {demo}",'High','']+[ms,s]+['']*(maxl-1)+['','',f"EPIC-{s}"]+['']*maxb)
    for d in tk:
        desc=d['desc']+"\n\nAcceptance criteria:\n"+"\n".join("* "+a for a in d['ac'])+"\n\nRequirements: "+", ".join(d['reqs'])+"\nStories: "+", ".join(d['us'])+"\n\nDefinition of Done: implementation, validation (automated tests), documentation (OpenAPI/CLAUDE.md as needed)."
        lab=d['labels']+[d['slice']]; lab+=['']*(maxl+1-len(lab))
        bl=[num[x] for x in blocks.get(d['id'],[])]; bl+=['']*(maxb-len(bl))
        w.writerow([num[d['id']],d['type'],f"{d['id']} {d['summary']}",desc,d['pri'],epic_id[d['slice']]]+lab+[f"{d['est']:g}d",pts[d['est']],d['id']]+bl)
# ---------- traceability ----------
o=["# 08. Traceability Matrix\n","> **Generated** from the ticket drafts by `jira` generator; do not edit by hand. Regenerate when tickets change.\n",
 f"**Coverage:** {len(fr)} requirements and {len(us)} stories; {len(tk)} tickets. Uncovered requirements: {len(unc_fr)}. Uncovered stories: {len(unc_us)}.\n",
 "## Requirement to tickets\n","| Requirement | Tickets |","|---|---|"]
o+=[f"| {x} | {', '.join(cov_fr[x])} |" for x in fr]
o+=["","## Story to tickets\n","| Story | Tickets |","|---|---|"]
o+=[f"| {x} | {', '.join(cov_us[x])} |" for x in us]
open(f"{DOCS}/08-traceability-matrix.md",'w').write("\n".join(o)+"\n")
json.dump(files,open(os.devnull,'w'))
print('written')
