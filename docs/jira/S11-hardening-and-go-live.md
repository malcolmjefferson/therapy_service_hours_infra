# S11: Hardening and go-live

> **Milestone:** M6 · **Tickets:** 13 · **Estimate:** 20.5 developer-days

## Slice goal
Security suites, performance, accessibility, restore drill, cost check, runbook, user guide and the production release.

## Demo / acceptance of the slice
All gates green on dev; runbook and user guide done; owner approves prod.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S11-01](#s11-01) | Task | Authorization negative test suite (six required cases) | 2 | S8-07, S10-08, S5-16 |
| [S11-02](#s11-02) | Task | Injection suite across every text, search, sort and import input | 2 | S4-11, S10-08 |
| [S11-03](#s11-03) | Task | Database privilege and IAM policy review tests | 1.5 | S5-16 |
| [S11-04](#s11-04) | Task | Load sanity and index review | 2 | S10-08, S8-07 |
| [S11-05](#s11-05) | Task | Assemble and stabilise full E2E suite in the pipeline | 2 | S11-01, S9-06 |
| [S11-06](#s11-06) | Task | Accessibility audit and fixes | 2 | S10-08, S9-06 |
| [S11-07](#s11-07) | Task | Observability polish and log redaction check | 1.5 | S11-04 |
| [S11-08](#s11-08) | Task | Cost verification against the $50 budget | 1 | S11-04 |
| [S11-09](#s11-09) | Task | Backup and restore drill | 1.5 | S11-03 |
| [S11-10](#s11-10) | Task | End-user guide (non-technical) and in-app help link | 1.5 | S10-08 |
| [S11-11](#s11-11) | Task | Runbook final: deploy, rollback, restore, rotate, add admin, CA bundle | 1.5 | S11-09, S11-07 |
| [S11-12](#s11-12) | Task | Security review: dependency scan, CSP, secrets scan | 1 | S11-02, S11-03 |
| [S11-13](#s11-13) | Task | Go-live checklist, doc finalisation and prod approval | 1 | S11-05, S11-06, S11-08, S11-10, S11-11, S11-12 |

---

### S11-01
**Authorization negative test suite (six required cases)**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | test, security |
| Requirements | NFR-SEC-02, NFR-SEC-06 |
| Stories | US-44 |
| Is blocked by | S8-07, S10-08, S5-16 |
| Blocks | S11-05 |

**Description**

Cross-organization requests, cross-organization supervisor lookup, non-peer schedule, supervisor acting on non-supervisee, non-admin on admin routes, admin reading entries without a link; run against real PostgreSQL in CI.

**Acceptance criteria**

- [ ] All six pass in CI
- [ ] Suite fails if a new route lacks an authz test (route inventory check)

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-02
**Injection suite across every text, search, sort and import input**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | test, security, adr-0006 |
| Requirements | NFR-SEC-01 |
| Stories | US-43 |
| Is blocked by | S4-11, S10-08 |
| Blocks | S11-12 |

**Description**

Generated from the OpenAPI spec: payloads (' OR 1=1 --, '; DROP TABLE, quotes, backslashes, %, _) against all string inputs, plus crafted .md rows.

**Acceptance criteria**

- [ ] Suite enumerates inputs from the spec so new inputs are covered automatically
- [ ] No data or behavior change
- [ ] Failures print the offending route

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-03
**Database privilege and IAM policy review tests**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | security, infra, adr-0001 |
| Requirements | NFR-SEC-01, NFR-SEC-04 |
| Stories | US-43 |
| Is blocked by | S5-16 |
| Blocks | S11-09, S11-12 |

**Description**

Tests proving app_rw cannot run DDL; IAM policies have no wildcards on data actions; cdk-nag or equivalent clean with documented exceptions.

**Acceptance criteria**

- [ ] app_rw DDL attempt fails
- [ ] Policy review recorded
- [ ] Exceptions listed with reasons

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-04
**Load sanity and index review**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, perf |
| Requirements | NFR-PERF-01, NFR-REL-01 |
| Stories | US-45 |
| Is blocked by | S10-08, S8-07 |
| Blocks | S11-07, S11-08 |

**Description**

k6 script at 50 users and 20,000 entries; EXPLAIN review of list, aggregate and schedule queries; verify reserved concurrency versus connection limit.

**Acceptance criteria**

- [ ] p95 under 500 ms (warm)
- [ ] No sequential scans on hot paths
- [ ] Cold start under 2 s measured

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-05
**Assemble and stabilise full E2E suite in the pipeline**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | e2e, ci |
| Requirements | NFR-OPS-02 |
| Stories | US-45 |
| Is blocked by | S11-01, S9-06 |
| Blocks | S11-13 |

**Description**

All critical-path Playwright tests (sign-in, log, request, accept, approve/reject/revert, schedule, admin invite and role change, import) run in the dev smoke stage with retries policy and artifacts.

**Acceptance criteria**

- [ ] Suite green three runs in a row
- [ ] Runtime under 15 minutes
- [ ] Flake policy documented

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-06
**Accessibility audit and fixes**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | a11y, frontend |
| Requirements | NFR-A11Y-01 |
| Stories | US-45 |
| Is blocked by | S10-08, S9-06 |
| Blocks | S11-13 |

**Description**

axe on all key pages plus manual keyboard and screen-reader pass of the schedule grid, progress bars, dialogs; fix findings.

**Acceptance criteria**

- [ ] No serious/critical axe violations
- [ ] Manual checklist signed off

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-07
**Observability polish and log redaction check**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Medium |
| Estimate | 1.5 day(s) · 3 points |
| Labels | ops, security |
| Requirements | NFR-OPS-01, NFR-OPS-04 |
| Stories | US-42 |
| Is blocked by | S11-04 |
| Blocks | S11-11 |

**Description**

CloudWatch dashboard, alarm tuning, request-id tracing across Lambda and Step Functions, test that logs never contain notes or client names.

**Acceptance criteria**

- [ ] Redaction test passes
- [ ] Dashboard shows errors, latency, throttles, DB connections

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-08
**Cost verification against the $50 budget**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | cost |
| Requirements | NFR-COST-01 |
| Stories | US-41 |
| Is blocked by | S11-04 |
| Blocks | S11-13 |

**Description**

Compare actual Cost Explorer or pricing-calculator numbers to the estimate; evaluate optional scheduled stop of the dev database.

**Acceptance criteria**

- [ ] Report shows monthly projection under $50
- [ ] Decision on dev DB stop recorded

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-09
**Backup and restore drill**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | ops |
| Requirements | NFR-REL-01 |
| Stories | US-45 |
| Is blocked by | S11-03 |
| Blocks | S11-11 |

**Description**

Restore a prod-like snapshot to a temporary instance, run migrations and smoke tests, delete the instance.

**Acceptance criteria**

- [ ] Restore time recorded
- [ ] Runbook updated with exact steps

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-10
**End-user guide (non-technical) and in-app help link**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Medium |
| Estimate | 1.5 day(s) · 3 points |
| Labels | docs |
| Requirements | NFR-DOC-01 |
| Stories | US-45 |
| Is blocked by | S10-08 |
| Blocks | S11-13 |

**Description**

Plain-language guide for trainees, supervisors and admins covering the screens in this app with fictional screenshots; link from the app header.

**Acceptance criteria**

- [ ] Reviewed by a non-technical reader
- [ ] Uses only pseudonyms
- [ ] Link present in the app

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-11
**Runbook final: deploy, rollback, restore, rotate, add admin, CA bundle**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | docs, ops |
| Requirements | NFR-DOC-01, NFR-OPS-02 |
| Stories | US-45 |
| Is blocked by | S11-09, S11-07 |
| Blocks | S11-13 |

**Description**

Complete operational runbook with failure playbooks for pipeline, migration, Cognito, and DB connection exhaustion.

**Acceptance criteria**

- [ ] Each playbook tested once in dev
- [ ] Linked from README

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-12
**Security review: dependency scan, CSP, secrets scan**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | security |
| Requirements | NFR-SEC-05 |
| Stories | US-43, US-45 |
| Is blocked by | S11-02, S11-03 |
| Blocks | S11-13 |

**Description**

Run govulncheck, npm audit, secret scanning, CSP violation review, header scan; triage findings.

**Acceptance criteria**

- [ ] No high/critical open findings or documented exceptions
- [ ] Secrets scan clean across repos

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S11-13
**Go-live checklist, doc finalisation and prod approval**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S11 Hardening and go-live |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | docs, release |
| Requirements | NFR-DOC-01 |
| Stories | US-45 |
| Is blocked by | S11-05, S11-06, S11-08, S11-10, S11-11, S11-12 |
| Blocks | - |

**Description**

Update CLAUDE.md and ADR statuses, confirm open questions closed, verify checklist, owner approves the prod stage.

**Acceptance criteria**

- [ ] All ADRs Accepted
- [ ] CLAUDE.md matches the built system
- [ ] Prod release approved and smoke-tested

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
