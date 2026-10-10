T = []
def t(*a): T.append(a)

# ---------------- S3 Goals and progress ----------------
t("S3-01","Story","Migration: goals table with defaults and last_celebrated_percent",
  "Create goals (unique user_id+goal_type, target_hours, last_celebrated_percent); defaults 1200/100/3000 and On-site with no target created when a user row is first bound.",
  "Defaults exist for every active user|Unique constraint enforced|Targets must be positive when set",
  1,"S2-01","FR-GOAL-01,FR-GOAL-02","US-09,US-10","backend,db","High")
t("S3-02","Story","Progress aggregate queries",
  "Static sqlc query returning approved and pending minutes per goal type, supervision group/individual split, and on-site totals; rejected excluded.",
  "Matches hand-computed fixtures|Single query per request (no N+1)|Uses (user_id, status) index (EXPLAIN reviewed)",
  1.5,"S3-01","FR-GOAL-01,FR-GOAL-03,FR-GOAL-05","US-09","backend,db","High")
t("S3-03","Story","Goals API: progress and target updates",
  "OpenAPI plus GET /goals/progress and PUT /goals/{type} for own targets with validation.",
  "Non-positive target returns 400|On-site target cannot be set|Another user's goals are not reachable",
  1.5,"S3-02,S1-07","FR-GOAL-02,FR-GOAL-03","US-09,US-10","backend,api","High")
t("S3-04","Task","Goal math unit tests",
  "Table-driven tests for approved/pending/rejected inclusion, rounding, percent calculation, supervision combination.",
  "Edge cases: zero entries, target change, over 100%|Percent rounding rule documented",
  1,"S3-02","FR-GOAL-03","US-09","backend,test","Medium")
t("S3-05","Story","ProgressBar component with ruler ticks and approved/pending segments",
  "Accessible bar: role=progressbar, aria-valuenow/max/valuetext, ticks at 25/50/75%, lighter pending segment, goal colors.",
  "aria-valuetext reads '312 of 1200 hours approved, 20 pending'|Contrast checks pass|Reduced motion respected",
  2,"S2-10","FR-GOAL-04,FR-GOAL-03","US-09","frontend,a11y","High")
t("S3-06","Story","Goal cards row, supervision split and target editing",
  "Cards for Direct, Supervision (with Group/Individual split), Total Activity and On-site; edit-target dialog.",
  "Editing a target updates the bar immediately|Invalid values show messages|On-site card has no target",
  2,"S3-05,S3-03","FR-GOAL-01,FR-GOAL-02,FR-GOAL-05","US-09,US-10","frontend","High")
t("S3-07","Task","Tests: RTL, axe and E2E for goals (with approved-hours test seeding)",
  "Until S7 exists, a dev-only seed helper marks entries approved; RTL/axe on cards; E2E changes a target.",
  "Helper is unavailable in prod builds|E2E passes|axe clean",
  1.5,"S3-06","FR-GOAL-03,FR-GOAL-04,NFR-A11Y-01","US-09,US-10","test,e2e","Medium")

# ---------------- S4 Import / export ----------------
t("S4-01","Task","OpenAPI: import and export endpoints",
  "Spec POST /import/markdown (size limits, report schema) and GET /export/entries (paged, all fields incl. times).",
  "Report schema lists imported, merged clients, skipped rows with reasons|Spectral clean",
  1,"S2-03","FR-IO-01,FR-IO-04","US-11,US-12","api","High")
t("S4-02","Story","Markdown ledger parser (both layouts)",
  "Parse the prototype format into typed values: Clients/Groups section, entries table with or without Start/End, escaped pipes, '; ' multi-client, '—' none, old single-client files; per-row errors.",
  "Golden files from the prototype parse correctly|Fuzz test does not panic|Unicode and long cells handled",
  2,"S4-01","FR-IO-01,FR-IO-03","US-11","backend,parser","High")
t("S4-03","Story","Import service: transactional parameterized inserts, client merge, Needs time",
  "Insert entries without times as needs_time with duration from Hours; merge clients case-insensitively; skip exact duplicates (assumption ASM-07); all in one transaction with a report.",
  "Re-importing the same file adds nothing and reports skipped|Bad rows are reported, valid rows kept (documented policy)|Rows with times obey overlap rules",
  2,"S4-02,S2-05","FR-IO-02,FR-IO-03","US-11","backend,db","High")
t("S4-04","Story","Import endpoint with limits",
  "Multipart upload, 1 MB limit, 5,000-row cap, content-type checks, authz own data only, Idempotency-Key.",
  "Oversize file returns 413 problem|Non-Markdown returns 400|Injection-like cell content stored as plain text",
  1.5,"S4-03,S2-09","FR-IO-01,FR-IO-03,NFR-SEC-01","US-11","backend,api,security","High")
t("S4-05","Story","Needs-time entries: add times via edit, badge, overlap exemption",
  "Editing a needs_time entry requires times and clears the flag; hours recalculate; table shows a 'Needs time' badge; overlap check ignores legacy entries.",
  "Flag clears on valid times|Hours change from legacy to calculated|Badge visible and announced",
  1.5,"S4-03,S2-15","FR-IO-02","US-17","backend,frontend","Medium")
t("S4-06","Story","Export data endpoint",
  "Paged, ownership-scoped export of all own entries with times, clients and status.",
  "Returns only own entries|Page size cap enforced|Includes Start and End",
  1,"S4-01,S2-06","FR-IO-04","US-12","backend,api","High")
t("S4-07","Story","Markdown export (round-trippable) shared serializer",
  "Frontend serializer to the prototype format plus Start/End columns, escaping pipes, '; ' client joins.",
  "Export then import yields identical entries (property test)|Header documented",
  1.5,"S4-06","FR-IO-04","US-12","frontend","High")
t("S4-08","Story","CSV export with formula-injection protection",
  "Neutralize cells starting with = + - @ tab or CR; RFC 4180 quoting; UTF-8 BOM option.",
  "Cell '=1+1' is exported as text|Commas/quotes/newlines preserved",
  1,"S4-06","FR-IO-05","US-12","frontend,security","Medium")
t("S4-09","Story","PDF export in the browser",
  "Lazy-loaded PDF generation (no server call) with goal summary and entries table including times; fonts embedded.",
  "No network request during generation|Multi-page tables paginate|Bundle size increase documented and lazy",
  2,"S4-06","FR-IO-06","US-12","frontend","Medium")
t("S4-10","Story","Import dialog and report UI",
  "Import and Export buttons on the Entries header row; file picker, progress, report with skipped-row reasons.",
  "Errors readable|Keyboard accessible|Report downloadable as text",
  1.5,"S4-04","FR-IO-01,FR-IO-02,FR-IO-03","US-11","frontend","High")
t("S4-11","Task","Tests: corpus, round trip, crafted injection rows, E2E import",
  "Go tests with prototype-generated corpus and malicious rows; frontend round-trip; Playwright import of a prototype file.",
  "Crafted rows with quotes, backslashes, % _ and SQL keywords import literally|E2E passes",
  2,"S4-10,S4-07,S4-08,S4-05","FR-IO-01,FR-IO-03,FR-IO-04,FR-IO-05,NFR-SEC-01","US-11,US-12","test,e2e,security","High")

# ---------------- S5 Admin console ----------------
t("S5-01","Story","Migration: admin_audit_log and user lifecycle columns",
  "Add admin_audit_log (actor snapshot, action, target, details jsonb), deactivated_at, indexes, and checks supporting deactivate-then-delete.",
  "Audit rows survive deletion of the target user|Index for newest-first paging",
  1,"S1-04","FR-ADM-05,FR-ADM-07","US-32,US-34","backend,db","High")
t("S5-02","Task","OpenAPI: admin routes (organizations, users, roles, audit)",
  "Spec all admin endpoints with 403 problem for non-admins, workflow error mapping (502 identity failure), pagination.",
  "Spectral clean|Admin schemas separate from entry models",
  1.5,"S5-01","FR-ADM-01,FR-ADM-02,FR-ADM-03,NFR-DOC-01","US-28,US-29","api","High")
t("S5-03","Story","Organizations CRUD with delete-blocked-when-nonempty",
  "Create/rename/list/delete; unique names; delete returns 409 when anyone belongs.",
  "Delete of non-empty org refused with count|Duplicate name returns 409|Every change audited",
  1.5,"S5-02,S1-07","FR-ADM-01,FR-ADM-07","US-28","backend,api","High")
t("S5-04","Story","admin-orchestrator Lambda and admin route wiring (ADR-0002)",
  "Non-VPC Lambda validating the admin group claim and input, starting Step Functions Express executions synchronously; API Gateway admin routes with tighter throttling.",
  "Non-admin token gets 403 and no execution starts|Request ID propagated into the execution|Role has only StartSyncExecution on the admin state machines",
  2,"S5-02,S1-01","FR-ADM-02,FR-ADM-03,NFR-SEC-02","US-29,US-30","backend,infra,adr-0002","Highest")
t("S5-05","Story","identity Lambda: idempotent Cognito admin operations",
  "Operations: create or link user, set groups, disable/enable, delete, global sign-out, change email; each safe to retry.",
  "Calling any operation twice yields the same final state|Errors are typed for the state machine|Role limited to the pool ARN",
  2,"S5-04,S1-02","FR-ADM-02,FR-ADM-03,FR-ADM-08","US-29,US-30,US-35","backend,auth,adr-0002","Highest")
t("S5-06","Story","Step Functions definitions: create, edit, role change with compensation",
  "CDK-defined Express state machines with Retry/Catch and compensation steps (data reserve, identity, data commit).",
  "Failure injected at each step leaves DB and Cognito consistent|Execution history visible for audit|No state machine has wildcard IAM",
  2,"S5-05","FR-ADM-02,FR-ADM-03","US-29,US-30","infra,adr-0002","Highest")
t("S5-07","Story","Data-step handlers: validate/reserve, commit, audit (user create, edit, roles)",
  "VPC api handlers invoked by the workflows: re-verify the actor is an active admin in the DB, transactional writes, audit log entry, required organization on create.",
  "Demoted admin is refused at the data step|Organization required (400 otherwise)|Audit row written in the same transaction",
  2,"S5-06,S5-03","FR-ADM-02,FR-ADM-03,FR-ADM-07","US-29,US-30,US-34","backend,db","Highest")
t("S5-08","Story","Deactivate and reactivate, with deactivated-user filtering everywhere",
  "Workflow disables Cognito user and signs out; a shared SQL predicate/view hides deactivated users from lists, searches and schedules; data kept.",
  "Deactivated user cannot sign in or use existing token (S1-06 check)|Not listed anywhere|Reactivation restores access",
  2,"S5-07","FR-ADM-05,FR-ADM-09,FR-AUTH-05","US-32","backend,infra","High")
t("S5-09","Story","Permanent delete workflow (two-step)",
  "Only for deactivated users; removes entries, clients, links, notifications, Cognito user; audit keeps display-name snapshot.",
  "Active user cannot be purged (409)|Cascade verified by tests|Audit snapshot present",
  2,"S5-08","FR-ADM-05,FR-ADM-07","US-32","backend,db","High")
t("S5-10","Story","Last-admin guard",
  "Within the transaction lock admin rows (SELECT ... FOR UPDATE) and refuse demote, deactivate or delete of the last active admin.",
  "Concurrent demotions of the last two admins: at most one succeeds|Clear problem+json explanation",
  1.5,"S5-07","FR-ADM-06","US-33","backend,db","Highest")
t("S5-11","Story","Email change re-invite workflow",
  "Edit email: new invitation, old email blocked immediately (Cognito and allowlist), first sign-in with new email re-binds to the same user_id.",
  "user_id and all data unchanged|Old email cannot sign in|Audit entry recorded",
  2,"S5-07,S1-03","FR-ADM-08,FR-AUTH-03","US-35","backend,auth","High")
t("S5-12","Story","Admin API: organization change endpoint and audit log listing",
  "Change a user's organization (preview endpoint returns consequence counts, which S6-08 completes); GET /admin/audit paginated newest first.",
  "Preview returns counts (zero until S6)|Audit listing paginates|No endpoint exposes entries or notes (FR-ADM-10)",
  1.5,"S5-07","FR-ADM-04,FR-ADM-07,FR-ADM-10","US-31,US-34,US-35","backend,api","High")
t("S5-13","Story","Frontend admin: users list, create/edit dialogs",
  "Users table with search, status filter, create/edit dialogs including required organization and email-change warning.",
  "Form validates required organization|Email change shows consequences|Deactivated users distinguishable",
  2,"S5-12,S1-11","FR-ADM-02,FR-ADM-08","US-29,US-35","frontend","High")
t("S5-14","Story","Frontend admin: organizations, roles and lifecycle actions",
  "Organizations page, role toggles, deactivate, permanent delete with type-to-confirm, last-admin error display.",
  "Delete requires typing the person's name|Errors from guards are readable",
  1.5,"S5-13","FR-ADM-01,FR-ADM-03,FR-ADM-05,FR-ADM-06","US-28,US-30,US-32,US-33","frontend","High")
t("S5-15","Story","Frontend admin: org-change confirmation and audit log page",
  "Consequences dialog before changing organization; audit log table.",
  "Nothing changes until confirmed|Dialog states link and pending-request effects|Audit page paginates",
  1.5,"S5-14","FR-ADM-04,FR-ADM-07","US-31,US-34","frontend","High")
t("S5-16","Task","Tests: workflow failure injection, admin authz negatives, E2E invite and role change",
  "Integration tests per workflow with failures at each step; non-admin and cross-user negatives; Playwright for invite and role change.",
  "All compensation paths verified|Non-admin routes return 403|E2E passes in dev",
  2,"S5-15,S5-09,S5-10,S5-11","FR-ADM-02,FR-ADM-03,FR-ADM-06,NFR-SEC-02","US-29,US-30,US-33","test,e2e,security","High")

# ---------------- S6 Supervision and notifications ----------------
t("S6-01","Story","Migration: supervision_links and notifications with DB-enforced rules",
  "Create tables; partial unique index (one pending/accepted per supervisee); supervisor<>supervisee check; trigger verifying supervisee and supervisor belong to the link's organization at pending/accepted.",
  "Cross-org insert fails in the DB|Second active link for a supervisee fails|Self-link fails",
  2,"S5-01,S1-04","FR-SUP-02,FR-NOT-01","US-14,US-26","backend,db","Highest")
t("S6-02","Task","OpenAPI: supervisors, requests, links, notifications",
  "Spec supervisor search, request create/cancel, inbox, accept/decline, end, notifications list/read/read-all/unread-count.",
  "Spectral clean|Search parameter lengths bounded",
  1.5,"S6-01","NFR-DOC-01,FR-SUP-01","US-14","api","High")
t("S6-03","Story","Supervisor search (same organization, first or last name)",
  "GET /supervisors?search=&page= returns active supervisors in the actor's organization via a dedicated DTO; LIKE wildcards escaped; term capped; excludes self.",
  "Other-org supervisors never returned|Wildcard characters match literally|Deactivated supervisors absent",
  1.5,"S6-02,S5-08","FR-SUP-01,NFR-SEC-01","US-14","backend,api,security","High")
t("S6-04","Story","Create and cancel supervision request",
  "Create request (same org, no active link, not self), cancel pending; notification to the supervisor created in the same transaction.",
  "Second request while one is pending returns 409|Cross-org request returns 403/404|Notification row exists",
  2,"S6-03,S6-07","FR-SUP-02,FR-NOT-01","US-14,US-25,US-27","backend,api","Highest")
t("S6-05","Story","Supervisor inbox, accept and decline with race-safe transaction",
  "List pending requests; accept re-checks organization and link state inside the transaction (SELECT ... FOR UPDATE); decline needs no reason; notify supervisee.",
  "Accept after cancel or org change returns 409 'no longer valid'|Concurrent accept/cancel: consistent result|Notifications created",
  2,"S6-04","FR-SUP-03,FR-SUP-05,FR-NOT-01","US-18","backend,api,db","Highest")
t("S6-06","Story","End a supervision link",
  "Supervisee, supervisor or admin ends an accepted link; history and past approvals kept; notify the other party.",
  "Third parties get 403/404|Supervisee can request again after ending|Past entry approvals unaffected",
  1.5,"S6-05","FR-SUP-04,FR-REV-08","US-27","backend,api","High")
t("S6-07","Story","Notifications service and endpoints",
  "In-transaction create helper, list (paginated), mark read, mark all read, unread-count; payload jsonb with typed schemas per event.",
  "Only own notifications accessible|Unread count correct under concurrent reads|Payloads contain pseudonym-safe data only",
  2,"S6-02","FR-NOT-01,FR-NOT-02,FR-NOT-03","US-25,US-26","backend,api","High")
t("S6-08","Story","Organization change ends links and cancels requests (completes FR-ADM-04)",
  "Hook in the admin org-change data step: end the user's link, cancel pending requests, and end all supervisees' links if the user is a supervisor; preview counts feed the confirmation dialog; notify affected users.",
  "Counts in preview equal actual effects|Supervisor org change ends all supervisee links|All effects in one transaction",
  1.5,"S6-06,S5-12","FR-ADM-04,FR-SUP-02","US-31","backend,db","High")
t("S6-09","Story","Frontend: Find a supervisor page",
  "Searchable list of supervisors with Request supervision / Request pending + cancel states and disabled states per rules.",
  "Search by first or last name|Button states match FR-SUP-01|Empty state explained",
  2,"S6-03,S6-04,S1-11","FR-SUP-01,FR-SUP-02","US-14","frontend","High")
t("S6-10","Story","Frontend: supervisor Requests page and nav badge",
  "Pending requests with Accept/Decline; badge count in navigation visible only to supervisors.",
  "Accept/Decline update the list and badge|Stale request error handled gracefully",
  1.5,"S6-05,S6-07","FR-SUP-03","US-18,US-25","frontend","High")
t("S6-11","Story","Frontend: notification polling, badge and inbox page",
  "TanStack Query polling about every 60 s plus refetch on window focus; badge; inbox with mark read and mark all.",
  "No polling while the tab is hidden beyond focus refetch|Badge updates after actions|Inbox keyboard accessible",
  2,"S6-07,S1-11","FR-NOT-02,FR-NOT-03","US-25,US-26","frontend","High")
t("S6-12","Story","Frontend: 'No active supervisor' banner and my-supervision controls",
  "Banner linking to Find a supervisor when no accepted link; panel to see current supervisor, cancel pending request, end link.",
  "Banner hidden when a link is accepted|End link asks for confirmation",
  1.5,"S6-09,S6-06","FR-SUP-06,FR-SUP-04","US-16,US-27","frontend","Medium")
t("S6-13","Task","Tests: DB constraint tests, cross-organization negatives, concurrency, E2E request-accept",
  "Integration tests for constraints and races; negative tests for cross-org lookup/request; Playwright: request, accept, notification badge.",
  "All negative tests pass|Concurrent accept/cancel/org-change deterministic|E2E passes",
  2,"S6-12,S6-10,S6-11,S6-08","FR-SUP-02,FR-SUP-05,NFR-SEC-02,NFR-SEC-06","US-14,US-18,US-25","test,e2e,security","High")

# ---------------- S7 Review workflow ----------------
t("S7-01","Story","Migration: entry_status_history and approved-entry immutability backstop",
  "Create entry_status_history (changed_by nullable plus name snapshot); trigger preventing UPDATE/DELETE of approved entries except by the revert path; status check constraint.",
  "Direct SQL update of an approved entry fails|History survives user deletion",
  1.5,"S6-01,S2-01","FR-REV-04,FR-REV-06","US-24,US-15","backend,db","Highest")
t("S7-02","Task","OpenAPI: review endpoints",
  "Spec review queue, approve, reject (reason), bulk approve, revert-approval (reason), history; conflict and skipped-entry schemas.",
  "Spectral clean|Bulk report schema lists skipped ids with reasons",
  1,"S7-01","FR-REV-01,FR-REV-02,FR-REV-03","US-21,US-22,US-23","api","High")
t("S7-03","Story","Review queue endpoint (supervisor scope)",
  "GET /review/entries for accepted supervisees only: status/supervisee/date filters, sort allowlist, pagination, supervisor DTO.",
  "Non-supervisee entries never returned|Ended links excluded|Unknown sort returns 400",
  1.5,"S7-02,S6-05","FR-REV-01,FR-DASH-02,NFR-SEC-02","US-21","backend,api,security","High")
t("S7-04","Story","Approve and reject single entries",
  "Conditional UPDATE WHERE status='pending'; reject requires reason; history row; notification to supervisee; 409 if not pending.",
  "Double approve: one wins, other 409|Non-supervisee returns 404|Empty reason returns 400",
  2,"S7-03,S6-07","FR-REV-01,FR-REV-06,FR-NOT-01","US-21,US-24","backend,api,db","Highest")
t("S7-05","Story","Bulk approve",
  "Approve by id list or date range for one supervisee in one transaction, conditional updates, report skipped entries with reasons, Idempotency-Key.",
  "Skipped entries reported (not pending, not owned)|Whole call atomic for approvals chosen|Replay returns the same report",
  2,"S7-04,S2-09","FR-REV-02","US-22","backend,api,db","High")
t("S7-06","Story","Revert approval",
  "Supervisor reverts to Pending with required reason; unlocks; history; notification; progress changes accordingly.",
  "Reason required|Only the owning accepted supervisor may revert|Entry editable again",
  1.5,"S7-04","FR-REV-03,FR-REV-06,FR-NOT-01","US-23","backend,api","High")
t("S7-07","Story","Entry locking and rejected-edit-to-pending in the service layer",
  "Update/delete refused for approved (423/409 with explanation); saving an edited rejected entry sets Pending, clears review fields and notifies the supervisor.",
  "Approved entry edit/delete refused|Rejected edit becomes Pending and history records it",
  1.5,"S7-04,S2-05","FR-REV-04,FR-REV-05,FR-REV-06","US-15","backend","High")
t("S7-08","Story","Entry history endpoint",
  "GET /entries/{id}/history visible to the owner and the owning accepted supervisor.",
  "Third parties get 404|Entries ordered by time",
  1,"S7-04","FR-REV-06","US-24","backend,api","Medium")
t("S7-09","Task","Goal progress responds to status changes: integration tests",
  "Verify approve, reject, revert and rejected-edit change approved/pending sums correctly via the S3 aggregates.",
  "Approve moves hours from pending to approved bar|Revert reverses it|Reject removes from pending",
  1,"S7-06,S7-07,S3-02","FR-GOAL-03,FR-REV-03","US-09,US-23","test","High")
t("S7-10","Story","Frontend: status chips, reasons, locked-row UX, status filter",
  "Pending/Approved/Rejected chips with reason text, disabled edit/delete with explanation for approved, status filter on entries.",
  "Chips have accessible names|Rejected reason visible|Filter by status works",
  2,"S7-07,S2-13","FR-REV-07,FR-REV-04,FR-REV-05","US-15","frontend","High")
t("S7-11","Story","Frontend: entry history drawer",
  "Drawer listing who changed what, when, from/to, and reason.",
  "Keyboard accessible|Empty history handled",
  1,"S7-08,S7-10","FR-REV-06","US-24","frontend","Medium")
t("S7-12","Story","Frontend: reusable review dialogs and bulk action bar",
  "Reason-required reject and revert dialogs, bulk selection bar with skipped-entry report; shared with S8.",
  "Empty reason blocked client-side and server-side|Report readable|RTL tests with MSW",
  2,"S7-05,S7-06,S2-10","FR-REV-01,FR-REV-02,FR-REV-03","US-21,US-22,US-23","frontend","High")
t("S7-13","Story","Frontend: supervisor review queue page",
  "Page listing pending (and approved for revert) entries across accepted supervisees with approve, reject, bulk approve and revert.",
  "Works for the supervisor persona flow end to end|Updates the list and notifications|axe clean",
  2,"S7-12,S7-03","FR-REV-01,FR-REV-02,FR-REV-03","US-21,US-22,US-23","frontend","High")
t("S7-14","Task","Tests: concurrency, authz negatives, E2E approve/reject/revert",
  "Integration tests for double-approve and bulk races, supervisor-on-non-supervisee, ended-link access; Playwright critical path.",
  "All negatives return 403/404|E2E passes in dev",
  2,"S7-13,S7-09,S7-11","FR-REV-01,FR-REV-02,FR-REV-03,FR-REV-04,NFR-SEC-06","US-21,US-22,US-23","test,e2e,security","High")
