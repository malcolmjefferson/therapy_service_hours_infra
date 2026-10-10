# S5: Organizations and admin console

> **Milestone:** M4 · **Tickets:** 16 · **Estimate:** 28 developer-days

## Slice goal
Admins manage organizations, users, roles, email changes, deactivation and deletion, with an audit log.

## Demo / acceptance of the slice
As admin: create an organization, invite a user, grant Supervisor, change an email, deactivate and permanently delete; non-admins are refused.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S5-01](#s5-01) | Story | Migration: admin_audit_log and user lifecycle columns | 1 | S1-04 |
| [S5-02](#s5-02) | Task | OpenAPI: admin routes (organizations, users, roles, audit) | 1.5 | S5-01 |
| [S5-03](#s5-03) | Story | Organizations CRUD with delete-blocked-when-nonempty | 1.5 | S5-02, S1-07 |
| [S5-04](#s5-04) | Story | admin-orchestrator Lambda and admin route wiring (ADR-0002) | 2 | S5-02, S1-01 |
| [S5-05](#s5-05) | Story | identity Lambda: idempotent Cognito admin operations | 2 | S5-04, S1-02 |
| [S5-06](#s5-06) | Story | Step Functions definitions: create, edit, role change with compensation | 2 | S5-05 |
| [S5-07](#s5-07) | Story | Data-step handlers: validate/reserve, commit, audit (user create, edit, roles) | 2 | S5-06, S5-03 |
| [S5-08](#s5-08) | Story | Deactivate and reactivate, with deactivated-user filtering everywhere | 2 | S5-07 |
| [S5-09](#s5-09) | Story | Permanent delete workflow (two-step) | 2 | S5-08 |
| [S5-10](#s5-10) | Story | Last-admin guard | 1.5 | S5-07 |
| [S5-11](#s5-11) | Story | Email change re-invite workflow | 2 | S5-07, S1-03 |
| [S5-12](#s5-12) | Story | Admin API: organization change endpoint and audit log listing | 1.5 | S5-07 |
| [S5-13](#s5-13) | Story | Frontend admin: users list, create/edit dialogs | 2 | S5-12, S1-11 |
| [S5-14](#s5-14) | Story | Frontend admin: organizations, roles and lifecycle actions | 1.5 | S5-13 |
| [S5-15](#s5-15) | Story | Frontend admin: org-change confirmation and audit log page | 1.5 | S5-14 |
| [S5-16](#s5-16) | Task | Tests: workflow failure injection, admin authz negatives, E2E invite and role change | 2 | S5-15, S5-09, S5-10, S5-11 |

---

### S5-01
**Migration: admin_audit_log and user lifecycle columns**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, db |
| Requirements | FR-ADM-05, FR-ADM-07 |
| Stories | US-32, US-34 |
| Is blocked by | S1-04 |
| Blocks | S5-02, S6-01 |

**Description**

Add admin_audit_log (actor snapshot, action, target, details jsonb), deactivated_at, indexes, and checks supporting deactivate-then-delete.

**Acceptance criteria**

- [ ] Audit rows survive deletion of the target user
- [ ] Index for newest-first paging

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-02
**OpenAPI: admin routes (organizations, users, roles, audit)**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | api |
| Requirements | FR-ADM-01, FR-ADM-02, FR-ADM-03, NFR-DOC-01 |
| Stories | US-28, US-29 |
| Is blocked by | S5-01 |
| Blocks | S5-03, S5-04 |

**Description**

Spec all admin endpoints with 403 problem for non-admins, workflow error mapping (502 identity failure), pagination.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Admin schemas separate from entry models

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-03
**Organizations CRUD with delete-blocked-when-nonempty**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-ADM-01, FR-ADM-07 |
| Stories | US-28 |
| Is blocked by | S5-02, S1-07 |
| Blocks | S5-07 |

**Description**

Create/rename/list/delete; unique names; delete returns 409 when anyone belongs.

**Acceptance criteria**

- [ ] Delete of non-empty org refused with count
- [ ] Duplicate name returns 409
- [ ] Every change audited

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-04
**admin-orchestrator Lambda and admin route wiring (ADR-0002)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, infra, adr-0002 |
| Requirements | FR-ADM-02, FR-ADM-03, NFR-SEC-02 |
| Stories | US-29, US-30 |
| Is blocked by | S5-02, S1-01 |
| Blocks | S5-05 |

**Description**

Non-VPC Lambda validating the admin group claim and input, starting Step Functions Express executions synchronously; API Gateway admin routes with tighter throttling.

**Acceptance criteria**

- [ ] Non-admin token gets 403 and no execution starts
- [ ] Request ID propagated into the execution
- [ ] Role has only StartSyncExecution on the admin state machines

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-05
**identity Lambda: idempotent Cognito admin operations**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, auth, adr-0002 |
| Requirements | FR-ADM-02, FR-ADM-03, FR-ADM-08 |
| Stories | US-29, US-30, US-35 |
| Is blocked by | S5-04, S1-02 |
| Blocks | S5-06 |

**Description**

Operations: create or link user, set groups, disable/enable, delete, global sign-out, change email; each safe to retry.

**Acceptance criteria**

- [ ] Calling any operation twice yields the same final state
- [ ] Errors are typed for the state machine
- [ ] Role limited to the pool ARN

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-06
**Step Functions definitions: create, edit, role change with compensation**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, adr-0002 |
| Requirements | FR-ADM-02, FR-ADM-03 |
| Stories | US-29, US-30 |
| Is blocked by | S5-05 |
| Blocks | S5-07 |

**Description**

CDK-defined Express state machines with Retry/Catch and compensation steps (data reserve, identity, data commit).

**Acceptance criteria**

- [ ] Failure injected at each step leaves DB and Cognito consistent
- [ ] Execution history visible for audit
- [ ] No state machine has wildcard IAM

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-07
**Data-step handlers: validate/reserve, commit, audit (user create, edit, roles)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db |
| Requirements | FR-ADM-02, FR-ADM-03, FR-ADM-07 |
| Stories | US-29, US-30, US-34 |
| Is blocked by | S5-06, S5-03 |
| Blocks | S5-08, S5-10, S5-11, S5-12 |

**Description**

VPC api handlers invoked by the workflows: re-verify the actor is an active admin in the DB, transactional writes, audit log entry, required organization on create.

**Acceptance criteria**

- [ ] Demoted admin is refused at the data step
- [ ] Organization required (400 otherwise)
- [ ] Audit row written in the same transaction

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-08
**Deactivate and reactivate, with deactivated-user filtering everywhere**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, infra |
| Requirements | FR-ADM-05, FR-ADM-09, FR-AUTH-05 |
| Stories | US-32 |
| Is blocked by | S5-07 |
| Blocks | S5-09, S6-03, S10-02 |

**Description**

Workflow disables Cognito user and signs out; a shared SQL predicate/view hides deactivated users from lists, searches and schedules; data kept.

**Acceptance criteria**

- [ ] Deactivated user cannot sign in or use existing token (S1-06 check)
- [ ] Not listed anywhere
- [ ] Reactivation restores access

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-09
**Permanent delete workflow (two-step)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db |
| Requirements | FR-ADM-05, FR-ADM-07 |
| Stories | US-32 |
| Is blocked by | S5-08 |
| Blocks | S5-16 |

**Description**

Only for deactivated users; removes entries, clients, links, notifications, Cognito user; audit keeps display-name snapshot.

**Acceptance criteria**

- [ ] Active user cannot be purged (409)
- [ ] Cascade verified by tests
- [ ] Audit snapshot present

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-10
**Last-admin guard**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db |
| Requirements | FR-ADM-06 |
| Stories | US-33 |
| Is blocked by | S5-07 |
| Blocks | S5-16 |

**Description**

Within the transaction lock admin rows (SELECT ... FOR UPDATE) and refuse demote, deactivate or delete of the last active admin.

**Acceptance criteria**

- [ ] Concurrent demotions of the last two admins: at most one succeeds
- [ ] Clear problem+json explanation

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-11
**Email change re-invite workflow**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, auth |
| Requirements | FR-ADM-08, FR-AUTH-03 |
| Stories | US-35 |
| Is blocked by | S5-07, S1-03 |
| Blocks | S5-16 |

**Description**

Edit email: new invitation, old email blocked immediately (Cognito and allowlist), first sign-in with new email re-binds to the same user_id.

**Acceptance criteria**

- [ ] user_id and all data unchanged
- [ ] Old email cannot sign in
- [ ] Audit entry recorded

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-12
**Admin API: organization change endpoint and audit log listing**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-ADM-04, FR-ADM-07, FR-ADM-10 |
| Stories | US-31, US-34, US-35 |
| Is blocked by | S5-07 |
| Blocks | S5-13, S6-08 |

**Description**

Change a user's organization (preview endpoint returns consequence counts, which S6-08 completes); GET /admin/audit paginated newest first.

**Acceptance criteria**

- [ ] Preview returns counts (zero until S6)
- [ ] Audit listing paginates
- [ ] No endpoint exposes entries or notes (FR-ADM-10)

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-13
**Frontend admin: users list, create/edit dialogs**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-ADM-02, FR-ADM-08 |
| Stories | US-29, US-35 |
| Is blocked by | S5-12, S1-11 |
| Blocks | S5-14 |

**Description**

Users table with search, status filter, create/edit dialogs including required organization and email-change warning.

**Acceptance criteria**

- [ ] Form validates required organization
- [ ] Email change shows consequences
- [ ] Deactivated users distinguishable

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-14
**Frontend admin: organizations, roles and lifecycle actions**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-ADM-01, FR-ADM-03, FR-ADM-05, FR-ADM-06 |
| Stories | US-28, US-30, US-32, US-33 |
| Is blocked by | S5-13 |
| Blocks | S5-15 |

**Description**

Organizations page, role toggles, deactivate, permanent delete with type-to-confirm, last-admin error display.

**Acceptance criteria**

- [ ] Delete requires typing the person's name
- [ ] Errors from guards are readable

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-15
**Frontend admin: org-change confirmation and audit log page**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-ADM-04, FR-ADM-07 |
| Stories | US-31, US-34 |
| Is blocked by | S5-14 |
| Blocks | S5-16 |

**Description**

Consequences dialog before changing organization; audit log table.

**Acceptance criteria**

- [ ] Nothing changes until confirmed
- [ ] Dialog states link and pending-request effects
- [ ] Audit page paginates

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S5-16
**Tests: workflow failure injection, admin authz negatives, E2E invite and role change**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S5 Organizations and admin console |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | FR-ADM-02, FR-ADM-03, FR-ADM-06, NFR-SEC-02 |
| Stories | US-29, US-30, US-33 |
| Is blocked by | S5-15, S5-09, S5-10, S5-11 |
| Blocks | S11-01, S11-03 |

**Description**

Integration tests per workflow with failures at each step; non-admin and cross-user negatives; Playwright for invite and role change.

**Acceptance criteria**

- [ ] All compensation paths verified
- [ ] Non-admin routes return 403
- [ ] E2E passes in dev

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
