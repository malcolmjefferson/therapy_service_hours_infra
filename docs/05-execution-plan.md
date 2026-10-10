# 05. Execution Plan

## 1. Approach

Work is organized into **12 vertical slices**. Each slice cuts through every layer it needs (database, API, UI, tests, deployment) and ends with something a person can **run and verify on dev**. A slice is not "done" because code merged; it is done when its **demo** passes (see each `jira/S*.md`).

**Rules**
- Interface first: `api/openapi.yaml` changes before the endpoint or client.
- Every ticket is ≤ 2 days with acceptance criteria and a Definition of Done.
- Each slice deploys through the real pipeline from the start (S0 builds it once).
- Anything marked **Recommended** in CLAUDE.md waits for its ADR to be **Accepted** (gate G0).
- Budget guard is enforced by an automated synth check (S0-06).

## 2. Slices at a glance

| Slice | Delivers | Tickets | Dev-days | Milestone | Depends on |
|---|---|--:|--:|---|---|
| S0 | Walking skeleton: pipeline, infra, Status page | 21 | 32 | M1 | decisions G0 |
| S1 | Invite-only Google sign-in, roles, first admin, authz framework | 13 | 19 | M2 | S0 |
| S2 | Log hours: entries, clients, table | 17 | 29 | M3 | S1 |
| S3 | Goals and progress bars | 7 | 10.5 | M3 | S2 |
| S4 | Import and export | 11 | 17 | M3 | S2 |
| S5 | Organizations and admin console | 16 | 28 | M4 | S1 |
| S6 | Supervision requests and notifications | 13 | 23 | M4 | S5 |
| S7 | Review workflow | 14 | 22 | M5 | S3, S6 |
| S8 | Supervisor dashboard | 7 | 12 | M5 | S7 |
| S9 | Milestone celebrations | 6 | 9 | M5 | S3, S7 |
| S10 | Team schedules | 8 | 13 | M6 | S2, S6 |
| S11 | Hardening and go-live | 13 | 20.5 | M6 | all |
| **Total** | | **146** | **235** | | |

Dependency graph: see `04-architecture-diagrams.md` §9.

## 3. Milestones

| Milestone | Slices | What the owner can do | Cumulative dev-days |
|---|---|---|--:|
| **M1 Skeleton live** | S0 | Open the dev and prod URLs; trigger a release; get alerts | 32 |
| **M2 Secure access** | S1 | Sign in with Google as first admin; uninvited users refused | 51 |
| **M3 Single-user MVP** | S2, S3, S4 | Replace the prototype: log hours, see goals, import the old ledger, export | 107.5 |
| **M4 Multi-user and supervision** | S5, S6 | Invite people, organize them, request and accept supervision | 158.5 |
| **M5 Review and celebrate** | S7, S8, S9 | Supervisors approve, reject, revert; progress counts approved hours; celebrations | 201.5 |
| **M6 Go-live** | S10, S11 | Team schedules; hardening complete; production approved | 235 |

**M3 is the first point the prototype can be retired** for personal use (Pending hours only; no supervisor yet). Because the prototype ledger imports with "Needs time", no history is lost.

## 4. Gates

| Gate | When | Condition |
|---|---|---|
| **G0 Decisions** | Before S0-07 (database) | ADR-0001 to 0006 Accepted or amended; spec §7 defaults confirmed (ticket S0-02) |
| **G1 OQ-01** | Before S1-01 | Spike S1-02 decides Google-only vs also email/password |
| **G2 Slice exit** | End of every slice | Slice DoD met; demo performed on dev; tests green in pipeline |
| **G3 Prod promotion** | After each milestone the owner wants live | Manual approval in the pipeline |
| **G4 Go-live** | End of S11 | S11-13 checklist complete |

## 5. Sequencing detail

1. **S0** is deliberately boring: it proves the delivery path before any product code exists. Critical order: S0-01 → S0-02 → S0-05/07/08 → S0-09/10 → S0-11/12 → S0-14/15 → S0-16.
2. **S1** introduces `internal/authz` (S1-07). Every later slice must call it; the route inventory check in S11-01 fails if one does not.
3. **S2 and S3, S4** can be split between two people (S3 and S4 only need S2's tables and endpoints).
4. **S5 can start after S1** and runs in parallel with S2 to S4 if there are two developers; it needs the identity Lambda (ADR-0002) so it carries the most infrastructure risk.
5. **S6 before S7**: supervision links must exist before review rules can be enforced.
6. **S9 is small** and can be pulled forward after S7 for morale; it has no other dependents.
7. **S11 tickets that are independent** (user guide S11-10, cost review S11-08) can run alongside S10.

## 6. Capacity and timeline (indicative)

Estimates are **developer-days of focused work** per ticket, written before any code exists and not adjusted for AI assistance. Treat them as a ±40% range and **re-baseline at the end of M1**, when real velocity is known.

| Scenario | Assumption | Duration |
|---|---|---|
| One developer, full time | 5 productive days per week | about 47 weeks |
| One developer, part time | 3 productive days per week | about 78 weeks |
| Two developers (backend/infra + frontend) | Frontend work is about 64 of 235 days; dependencies allow overlap from S2 | about 26 to 30 weeks |
| Dependency-only lower bound | Critical path through the ticket graph | about 47.5 dev-days |

The ticket graph's critical path is short (about 47.5 days) because most work can proceed in parallel once S0 and S1 exist. The real limit is how many people work at once.

**Levers if time must shrink (in order):** (1) defer S9 (celebrations); (2) defer S4's PDF (S4-09); (3) defer S11-12 and S11-07 polish; (4) ship M4 without notifications polish. Do **not** cut security suites (S11-01, S11-02) or the authz negative tests.

## 7. Risks and mitigations

| Risk | Impact | Mitigation | Owner ticket |
|---|---|---|---|
| Cognito native vs Google account linking | Duplicate identities, sign-in loops | Spike first; prefer Google-only | S1-02 |
| No-NAT design blocks a needed call (Cognito, Step Functions, Secrets Manager) | Late redesign | ADR-0001/0002 designed around it; S0 proves DB access, S1 proves Cognito | S0-09, S1-03 |
| Lambda connection exhaustion on db.t4g.micro | Outages under load | Pool of 2, reserved concurrency, load test | S0-11, S11-04 |
| Migration breaks running code | Downtime | Expand/contract, migrate before deploy, contract tag check | S0-10 |
| Cross-organization data leakage / IDOR | Privacy breach | Central authz, DB-level org check, negative tests | S1-07, S6-01, S11-01 |
| Peer schedule DTO leaks fields | Privacy breach | Dedicated DTO, golden leak test | S10-04, S10-08 |
| Budget drift | Over $50/month | Synth-time guard, budget alarm, review | S0-06, S0-18, S11-08 |
| In-app-only notifications missed | Slow reviews | Badge and polling now; email deferred | S6-11 |
| Estimate optimism | Late delivery | Re-baseline after M1; cut levers above | n/a |
| Owner-only steps delayed (GitHub, Google OAuth, SNS) | Blocks S0/S1 | Owner action list in `jira/README.md` | S0-01, S1-01 |

## 8. Team working agreements

- Small PRs, one ticket per PR, linked ticket id in the title.
- PR descriptions use Markdown headers and bullets: **What**, **Why**, **How to verify**, **Risk**.
- A ticket moves to Done only when its Definition of Done boxes are checked.
- After each slice: 30-minute demo and retro; update this plan's risks and estimates.
- Record any decision that changes CLAUDE.md in an ADR first.
