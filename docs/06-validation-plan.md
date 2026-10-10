# 06. Validation Plan

How we prove each slice works, is secure, and stays working. It follows CLAUDE.md §14 and adds per-slice exit checks.

## 1. Principles

- **Real dependencies over mocks for data:** Go integration tests use **Testcontainers PostgreSQL** with migrations applied for real. No in-memory databases.
- **Tests at the lowest useful layer**, with a thin set of end-to-end paths on top.
- **Security tests are first-class** and generated from the OpenAPI spec where possible, so new inputs and routes are covered automatically.
- **Fixtures use pseudonyms only** (e.g. "A.B.", "Group C"). No real names anywhere.
- **Every requirement traces to a test** through its tickets (`08-traceability-matrix.md`).

## 2. Test layers

| Layer | Tooling | Scope | Runs |
|---|---|---|---|
| Go unit | `go test`, table-driven | Business rules: entry validation, lifecycle, goal math, milestone crossing, markdown parser | Every PR |
| Go integration | Testcontainers PostgreSQL | Constraints, overlap exclusion, authz negatives, injection, transactions and races, workflows | Every PR |
| API contract | `spectral`, `oasdiff`, generated server interface, response schema validation | Spec quality, breaking changes, responses match spec | Every PR |
| Frontend unit and integration | Vitest, React Testing Library, **MSW** | Components and flows by user behavior | Every PR |
| Accessibility | `axe` in RTL and Playwright | Key pages; manual keyboard and screen-reader pass at S11-06 | Every PR (automated), S11 (manual) |
| End-to-end | Playwright against **dev** | Critical paths (section 5) | Dev smoke stage on every release |
| Infrastructure | CDK assertions, `cdk synth`, budget-guard Aspect, `cdk-nag` | Tags, no NAT/ALB/endpoints, IAM least privilege | Every PR in infra |
| Security static | `gosec`, `govulncheck`, Semgrep, `npm audit`, secret scan | Dependencies and code patterns | Every PR, nightly for vulnerability feeds |
| Performance | k6 | 50 users, 20,000 entries | S11-04, then before big releases |
| Recovery | Snapshot restore drill | Restore, migrate, smoke | S11-09 |

## 3. Quality gates

**Pull request gate (must pass to merge)**

1. Lint and type check (`golangci-lint`, `eslint`, `tsc`)
2. Unit and integration tests
3. `gosec` (G201/G202), Semgrep no-string-SQL rule, `govulncheck`, `npm audit` (high and above)
4. `sqlc` output current; OpenAPI codegen current; `spectral` clean; `oasdiff` shows no unlabeled breaking change
5. Frontend drift gate: pinned spec equals the backend spec
6. `cdk synth` passes with tag and budget-guard assertions (infra repo)
7. Migration lint: no untagged `DROP`

**Release gate (dev to prod)**

1. All PR gates on the release commits of all three repos
2. Migration succeeded on dev
3. Smoke: `/healthz`, an authenticated `/me`, header scan
4. E2E critical paths green
5. Manual owner approval, showing the three commit SHAs

## 4. Per-slice validation

| Slice | Automated checks (highlights) | Slice exit demo (manual, on dev) |
|---|---|---|
| **S0** | Middleware unit tests; token refresh test; migrate idempotency and concurrency; budget-guard fixture test; header scan; deep-link and API 404 shape | Status page shows version and DB check on dev and prod; a broken migration stops the release; an alert email arrives |
| **S1** | PreSignUp allow/deny; first-sign-in sub binding (concurrent); deactivated refused; stale-token demotion; E2E invited and denied | Invited Google account signs in and sees its name; uninvited sees the access-denied message |
| **S2** | Constraint tests (15-min, end>start, overlap exclusion); concurrent overlap; sort allowlist 400; LIKE escaping; injection payloads; RTL form and table; axe | Add clients; log 3 entries; attempt an overlap; sort, filter, edit, delete |
| **S3** | Goal math tables; aggregate fixtures; progressbar `aria-valuetext`; contrast tests | Targets edit and bars update; Supervision split shown |
| **S4** | Golden prototype files; fuzz parser; crafted injection rows; round-trip property test; CSV formula neutralization; no-network PDF | Import prototype file, read the report; export MD/CSV/PDF; re-import MD |
| **S5** | Failure injection at each workflow step; non-admin 403; last-admin race; email-change rebind; cascade delete; audit rows | Invite, grant role, change email, move org (confirm dialog), deactivate, delete |
| **S6** | DB constraint tests (cross-org, one active link, self); race accept vs cancel vs org change; search escaping; badge polling | Request, accept; both sides see state; cross-org supervisor invisible |
| **S7** | Double-approve race; bulk skipped report; immutability trigger; rejected-edit to pending; progress after each transition; ended-link access | Approve, reject, bulk approve, revert; trainee chips and reasons |
| **S8** | Non-supervisee and ended-link 404; summary equals trainee's own view | Supervisor reviews from the drill-down |
| **S9** | Milestone computation tables; concurrent ack; replay scenarios | Approve past 25%: one celebration; reload: none; revert and re-approve: none |
| **S10** | DTO leak golden test; non-peer 404; Monday validation; weekend count; responsive and keyboard tests | Two peers view each other's weeks; no private fields visible |
| **S11** | Six authz negatives; spec-driven injection suite; DB privilege tests; k6 results; full E2E; restore drill | Go-live checklist signed |

## 5. End-to-end critical paths (Playwright)

1. Invited sign-in and uninvited refusal (S1-13)
2. Log an entry, overlap blocked, edit, delete (S2-17)
3. Import the prototype `.md` file and see the report (S4-11)
4. Admin invites a user and changes a role (S5-16)
5. Request supervisor, accept, notification badge (S6-13)
6. Approve, reject, bulk approve, revert (S7-14)
7. Supervisor dashboard review (S8-07)
8. Milestone celebration once (S9-06)
9. Peer schedule (S10-08)

**Authentication in E2E:** Google sign-in cannot be automated. The test-user strategy is decided in spike S1-02 (proposal: a dev-only Cognito test user obtained with admin-initiated auth, disabled in prod).

## 6. Security validation

| Control | Evidence |
|---|---|
| Bound parameters only (NFR-SEC-01) | Semgrep and gosec gates; spec-driven injection suite (S11-02); crafted `.md` rows (S4-11) |
| Central authz and IDOR (NFR-SEC-02) | Route inventory check; six negative tests (S11-01); per-slice negatives |
| No data exposure (NFR-SEC-03) | Leak golden tests for peer and supervisor DTOs (S10-08); log redaction test (S11-07) |
| Least privilege (NFR-SEC-04) | `app_rw` DDL denial test; IAM wildcard review; `cdk-nag` (S11-03) |
| Dependencies and headers (NFR-SEC-05) | `govulncheck`, `npm audit`, Dependabot, header scan, CSP review (S11-12) |
| Budget guard (NFR-COST-01) | Synth-time assertion (S0-06); cost review (S11-08) |

**Injection payload set:** `' OR 1=1 --`, `'; DROP TABLE entries; --`, single and double quotes, backslashes, `%`, `_`, null bytes, very long strings, Unicode. Expected result: literal storage or match, or a clean 400; never an error that reveals SQL, never changed data.

## 7. Non-functional validation

| Target | Method | Pass |
|---|---|---|
| p95 latency < 500 ms (list, aggregate, schedule) | k6 at 50 users and 20,000 entries; `EXPLAIN` review | Met warm; cold start < 2 s |
| Connection safety | Concurrency test with reserved concurrency cap | No "too many connections" errors |
| Accessibility AA | axe automated plus manual checklist | No serious or critical violations |
| Recovery | Snapshot restore drill | Documented time; app works after restore |
| Cost | Cost Explorer or pricing calculator | Projection below $50 per month |

## 8. Manual test scripts

Short scripts live in each slice's demo (see `jira/S*.md`). For release candidates, use this smoke list on dev:

1. Sign in as each persona type (User, Supervisor, Admin).
2. Log, edit and delete an entry; confirm overlap is blocked.
3. Request supervision; accept; approve and revert an entry.
4. Confirm the goal bars change only with approved hours.
5. Open Team Schedules for a peer; confirm only time and category.
6. Export Markdown, CSV and PDF; import the Markdown back.
7. As admin, change a user's organization and read the confirmation dialog.
8. Check the alarm email path by tripping a test alarm (quarterly).

## 9. Test data

- Generated by scripts, never copied from real use. Names are fictional personas (Maya, Priya, Sam, Jordan) with `@example.test` emails.
- Dev-only helpers (seed approved hours, add invitations) are compiled out of prod builds (S3-07, S1-09).
- Prod contains no test data other than the seeded first admin and "Default Organization".

## 10. Defect handling

| Severity | Definition | Response |
|---|---|---|
| **Blocker** | Data leak, wrong authorization, data loss, injection | Stop the release; fix first; add a regression test and a negative test |
| **Major** | Feature broken, no workaround | Fix in the current slice |
| **Minor** | Cosmetic or workaround exists | Backlog, triage at slice retro |

Every fixed defect gets a regression test at the lowest layer that can catch it.

## 11. Exit criteria for go-live

- All slices passed their exit demo (G2).
- All PR and release gates green on the release commits.
- Zero open Blocker or Major defects; no unaccepted high/critical vulnerabilities.
- E2E critical paths green three consecutive runs.
- Restore drill, cost review, runbook and user guide complete.
- ADR-0001 to ADR-0006 Accepted and CLAUDE.md updated.
