# S7: Review workflow

> **Milestone:** M5 · **Tickets:** 14 · **Estimate:** 22 developer-days

## Slice goal
Approve, reject (reason), bulk approve, revert (reason), history, locking, and approved-hours-driven progress.

## Demo / acceptance of the slice
A supervisor approves, rejects and reverts entries; the trainee sees chips and reasons; goal bars follow approved hours.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S7-01](#s7-01) | Story | Migration: entry_status_history and approved-entry immutability backstop | 1.5 | S6-01, S2-01 |
| [S7-02](#s7-02) | Task | OpenAPI: review endpoints | 1 | S7-01 |
| [S7-03](#s7-03) | Story | Review queue endpoint (supervisor scope) | 1.5 | S7-02, S6-05 |
| [S7-04](#s7-04) | Story | Approve and reject single entries | 2 | S7-03, S6-07 |
| [S7-05](#s7-05) | Story | Bulk approve | 2 | S7-04, S2-09 |
| [S7-06](#s7-06) | Story | Revert approval | 1.5 | S7-04 |
| [S7-07](#s7-07) | Story | Entry locking and rejected-edit-to-pending in the service layer | 1.5 | S7-04, S2-05 |
| [S7-08](#s7-08) | Story | Entry history endpoint | 1 | S7-04 |
| [S7-09](#s7-09) | Task | Goal progress responds to status changes: integration tests | 1 | S7-06, S7-07, S3-02 |
| [S7-10](#s7-10) | Story | Frontend: status chips, reasons, locked-row UX, status filter | 2 | S7-07, S2-13 |
| [S7-11](#s7-11) | Story | Frontend: entry history drawer | 1 | S7-08, S7-10 |
| [S7-12](#s7-12) | Story | Frontend: reusable review dialogs and bulk action bar | 2 | S7-05, S7-06, S2-10 |
| [S7-13](#s7-13) | Story | Frontend: supervisor review queue page | 2 | S7-12, S7-03 |
| [S7-14](#s7-14) | Task | Tests: concurrency, authz negatives, E2E approve/reject/revert | 2 | S7-13, S7-09, S7-11 |

---

### S7-01
**Migration: entry_status_history and approved-entry immutability backstop**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db |
| Requirements | FR-REV-04, FR-REV-06 |
| Stories | US-24, US-15 |
| Is blocked by | S6-01, S2-01 |
| Blocks | S7-02 |

**Description**

Create entry_status_history (changed_by nullable plus name snapshot); trigger preventing UPDATE/DELETE of approved entries except by the revert path; status check constraint.

**Acceptance criteria**

- [ ] Direct SQL update of an approved entry fails
- [ ] History survives user deletion

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-02
**OpenAPI: review endpoints**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api |
| Requirements | FR-REV-01, FR-REV-02, FR-REV-03 |
| Stories | US-21, US-22, US-23 |
| Is blocked by | S7-01 |
| Blocks | S7-03 |

**Description**

Spec review queue, approve, reject (reason), bulk approve, revert-approval (reason), history; conflict and skipped-entry schemas.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Bulk report schema lists skipped ids with reasons

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-03
**Review queue endpoint (supervisor scope)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api, security |
| Requirements | FR-REV-01, FR-DASH-02, NFR-SEC-02 |
| Stories | US-21 |
| Is blocked by | S7-02, S6-05 |
| Blocks | S7-04, S7-13, S8-03 |

**Description**

GET /review/entries for accepted supervisees only: status/supervisee/date filters, sort allowlist, pagination, supervisor DTO.

**Acceptance criteria**

- [ ] Non-supervisee entries never returned
- [ ] Ended links excluded
- [ ] Unknown sort returns 400

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-04
**Approve and reject single entries**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, db |
| Requirements | FR-REV-01, FR-REV-06, FR-NOT-01 |
| Stories | US-21, US-24 |
| Is blocked by | S7-03, S6-07 |
| Blocks | S7-05, S7-06, S7-07, S7-08, S8-01, S9-01 |

**Description**

Conditional UPDATE WHERE status='pending'; reject requires reason; history row; notification to supervisee; 409 if not pending.

**Acceptance criteria**

- [ ] Double approve: one wins, other 409
- [ ] Non-supervisee returns 404
- [ ] Empty reason returns 400

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-05
**Bulk approve**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, db |
| Requirements | FR-REV-02 |
| Stories | US-22 |
| Is blocked by | S7-04, S2-09 |
| Blocks | S7-12 |

**Description**

Approve by id list or date range for one supervisee in one transaction, conditional updates, report skipped entries with reasons, Idempotency-Key.

**Acceptance criteria**

- [ ] Skipped entries reported (not pending, not owned)
- [ ] Whole call atomic for approvals chosen
- [ ] Replay returns the same report

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-06
**Revert approval**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-REV-03, FR-REV-06, FR-NOT-01 |
| Stories | US-23 |
| Is blocked by | S7-04 |
| Blocks | S7-09, S7-12 |

**Description**

Supervisor reverts to Pending with required reason; unlocks; history; notification; progress changes accordingly.

**Acceptance criteria**

- [ ] Reason required
- [ ] Only the owning accepted supervisor may revert
- [ ] Entry editable again

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-07
**Entry locking and rejected-edit-to-pending in the service layer**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend |
| Requirements | FR-REV-04, FR-REV-05, FR-REV-06 |
| Stories | US-15 |
| Is blocked by | S7-04, S2-05 |
| Blocks | S7-09, S7-10 |

**Description**

Update/delete refused for approved (423/409 with explanation); saving an edited rejected entry sets Pending, clears review fields and notifies the supervisor.

**Acceptance criteria**

- [ ] Approved entry edit/delete refused
- [ ] Rejected edit becomes Pending and history records it

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-08
**Entry history endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, api |
| Requirements | FR-REV-06 |
| Stories | US-24 |
| Is blocked by | S7-04 |
| Blocks | S7-11 |

**Description**

GET /entries/{id}/history visible to the owner and the owning accepted supervisor.

**Acceptance criteria**

- [ ] Third parties get 404
- [ ] Entries ordered by time

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-09
**Goal progress responds to status changes: integration tests**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | test |
| Requirements | FR-GOAL-03, FR-REV-03 |
| Stories | US-09, US-23 |
| Is blocked by | S7-06, S7-07, S3-02 |
| Blocks | S7-14 |

**Description**

Verify approve, reject, revert and rejected-edit change approved/pending sums correctly via the S3 aggregates.

**Acceptance criteria**

- [ ] Approve moves hours from pending to approved bar
- [ ] Revert reverses it
- [ ] Reject removes from pending

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-10
**Frontend: status chips, reasons, locked-row UX, status filter**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-REV-07, FR-REV-04, FR-REV-05 |
| Stories | US-15 |
| Is blocked by | S7-07, S2-13 |
| Blocks | S7-11 |

**Description**

Pending/Approved/Rejected chips with reason text, disabled edit/delete with explanation for approved, status filter on entries.

**Acceptance criteria**

- [ ] Chips have accessible names
- [ ] Rejected reason visible
- [ ] Filter by status works

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-11
**Frontend: entry history drawer**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | frontend |
| Requirements | FR-REV-06 |
| Stories | US-24 |
| Is blocked by | S7-08, S7-10 |
| Blocks | S7-14 |

**Description**

Drawer listing who changed what, when, from/to, and reason.

**Acceptance criteria**

- [ ] Keyboard accessible
- [ ] Empty history handled

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-12
**Frontend: reusable review dialogs and bulk action bar**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-REV-01, FR-REV-02, FR-REV-03 |
| Stories | US-21, US-22, US-23 |
| Is blocked by | S7-05, S7-06, S2-10 |
| Blocks | S7-13, S8-06 |

**Description**

Reason-required reject and revert dialogs, bulk selection bar with skipped-entry report; shared with S8.

**Acceptance criteria**

- [ ] Empty reason blocked client-side and server-side
- [ ] Report readable
- [ ] RTL tests with MSW

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-13
**Frontend: supervisor review queue page**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-REV-01, FR-REV-02, FR-REV-03 |
| Stories | US-21, US-22, US-23 |
| Is blocked by | S7-12, S7-03 |
| Blocks | S7-14 |

**Description**

Page listing pending (and approved for revert) entries across accepted supervisees with approve, reject, bulk approve and revert.

**Acceptance criteria**

- [ ] Works for the supervisor persona flow end to end
- [ ] Updates the list and notifications
- [ ] axe clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S7-14
**Tests: concurrency, authz negatives, E2E approve/reject/revert**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S7 Review workflow |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | FR-REV-01, FR-REV-02, FR-REV-03, FR-REV-04, NFR-SEC-06 |
| Stories | US-21, US-22, US-23 |
| Is blocked by | S7-13, S7-09, S7-11 |
| Blocks | - |

**Description**

Integration tests for double-approve and bulk races, supervisor-on-non-supervisee, ended-link access; Playwright critical path.

**Acceptance criteria**

- [ ] All negatives return 403/404
- [ ] E2E passes in dev

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
