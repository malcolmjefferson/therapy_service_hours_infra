# S6: Supervision and notifications

> **Milestone:** M4 · **Tickets:** 13 · **Estimate:** 23 developer-days

## Slice goal
Find a supervisor in the same organization, request, accept or decline, end a link, and see in-app notifications.

## Demo / acceptance of the slice
A trainee requests a supervisor; the supervisor sees the badge, accepts; both see the right state; cross-organization attempts fail.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S6-01](#s6-01) | Story | Migration: supervision_links and notifications with DB-enforced rules | 2 | S5-01, S1-04 |
| [S6-02](#s6-02) | Task | OpenAPI: supervisors, requests, links, notifications | 1.5 | S6-01 |
| [S6-03](#s6-03) | Story | Supervisor search (same organization, first or last name) | 1.5 | S6-02, S5-08 |
| [S6-04](#s6-04) | Story | Create and cancel supervision request | 2 | S6-03, S6-07 |
| [S6-05](#s6-05) | Story | Supervisor inbox, accept and decline with race-safe transaction | 2 | S6-04 |
| [S6-06](#s6-06) | Story | End a supervision link | 1.5 | S6-05 |
| [S6-07](#s6-07) | Story | Notifications service and endpoints | 2 | S6-02 |
| [S6-08](#s6-08) | Story | Organization change ends links and cancels requests (completes FR-ADM-04) | 1.5 | S6-06, S5-12 |
| [S6-09](#s6-09) | Story | Frontend: Find a supervisor page | 2 | S6-03, S6-04, S1-11 |
| [S6-10](#s6-10) | Story | Frontend: supervisor Requests page and nav badge | 1.5 | S6-05, S6-07 |
| [S6-11](#s6-11) | Story | Frontend: notification polling, badge and inbox page | 2 | S6-07, S1-11 |
| [S6-12](#s6-12) | Story | Frontend: 'No active supervisor' banner and my-supervision controls | 1.5 | S6-09, S6-06 |
| [S6-13](#s6-13) | Task | Tests: DB constraint tests, cross-organization negatives, concurrency, E2E request-accept | 2 | S6-12, S6-10, S6-11, S6-08 |

---

### S6-01
**Migration: supervision_links and notifications with DB-enforced rules**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db |
| Requirements | FR-SUP-02, FR-NOT-01 |
| Stories | US-14, US-26 |
| Is blocked by | S5-01, S1-04 |
| Blocks | S6-02, S7-01 |

**Description**

Create tables; partial unique index (one pending/accepted per supervisee); supervisor<>supervisee check; trigger verifying supervisee and supervisor belong to the link's organization at pending/accepted.

**Acceptance criteria**

- [ ] Cross-org insert fails in the DB
- [ ] Second active link for a supervisee fails
- [ ] Self-link fails

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-02
**OpenAPI: supervisors, requests, links, notifications**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | api |
| Requirements | NFR-DOC-01, FR-SUP-01 |
| Stories | US-14 |
| Is blocked by | S6-01 |
| Blocks | S6-03, S6-07, S10-01 |

**Description**

Spec supervisor search, request create/cancel, inbox, accept/decline, end, notifications list/read/read-all/unread-count.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Search parameter lengths bounded

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-03
**Supervisor search (same organization, first or last name)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api, security |
| Requirements | FR-SUP-01, NFR-SEC-01 |
| Stories | US-14 |
| Is blocked by | S6-02, S5-08 |
| Blocks | S6-04, S6-09 |

**Description**

GET /supervisors?search=&page= returns active supervisors in the actor's organization via a dedicated DTO; LIKE wildcards escaped; term capped; excludes self.

**Acceptance criteria**

- [ ] Other-org supervisors never returned
- [ ] Wildcard characters match literally
- [ ] Deactivated supervisors absent

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-04
**Create and cancel supervision request**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api |
| Requirements | FR-SUP-02, FR-NOT-01 |
| Stories | US-14, US-25, US-27 |
| Is blocked by | S6-03, S6-07 |
| Blocks | S6-05, S6-09 |

**Description**

Create request (same org, no active link, not self), cancel pending; notification to the supervisor created in the same transaction.

**Acceptance criteria**

- [ ] Second request while one is pending returns 409
- [ ] Cross-org request returns 403/404
- [ ] Notification row exists

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-05
**Supervisor inbox, accept and decline with race-safe transaction**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, db |
| Requirements | FR-SUP-03, FR-SUP-05, FR-NOT-01 |
| Stories | US-18 |
| Is blocked by | S6-04 |
| Blocks | S6-06, S6-10, S7-03, S8-01 |

**Description**

List pending requests; accept re-checks organization and link state inside the transaction (SELECT ... FOR UPDATE); decline needs no reason; notify supervisee.

**Acceptance criteria**

- [ ] Accept after cancel or org change returns 409 'no longer valid'
- [ ] Concurrent accept/cancel: consistent result
- [ ] Notifications created

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-06
**End a supervision link**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-SUP-04, FR-REV-08 |
| Stories | US-27 |
| Is blocked by | S6-05 |
| Blocks | S6-08, S6-12 |

**Description**

Supervisee, supervisor or admin ends an accepted link; history and past approvals kept; notify the other party.

**Acceptance criteria**

- [ ] Third parties get 403/404
- [ ] Supervisee can request again after ending
- [ ] Past entry approvals unaffected

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-07
**Notifications service and endpoints**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api |
| Requirements | FR-NOT-01, FR-NOT-02, FR-NOT-03 |
| Stories | US-25, US-26 |
| Is blocked by | S6-02 |
| Blocks | S6-04, S6-10, S6-11, S7-04 |

**Description**

In-transaction create helper, list (paginated), mark read, mark all read, unread-count; payload jsonb with typed schemas per event.

**Acceptance criteria**

- [ ] Only own notifications accessible
- [ ] Unread count correct under concurrent reads
- [ ] Payloads contain pseudonym-safe data only

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-08
**Organization change ends links and cancels requests (completes FR-ADM-04)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db |
| Requirements | FR-ADM-04, FR-SUP-02 |
| Stories | US-31 |
| Is blocked by | S6-06, S5-12 |
| Blocks | S6-13 |

**Description**

Hook in the admin org-change data step: end the user's link, cancel pending requests, and end all supervisees' links if the user is a supervisor; preview counts feed the confirmation dialog; notify affected users.

**Acceptance criteria**

- [ ] Counts in preview equal actual effects
- [ ] Supervisor org change ends all supervisee links
- [ ] All effects in one transaction

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-09
**Frontend: Find a supervisor page**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-SUP-01, FR-SUP-02 |
| Stories | US-14 |
| Is blocked by | S6-03, S6-04, S1-11 |
| Blocks | S6-12 |

**Description**

Searchable list of supervisors with Request supervision / Request pending + cancel states and disabled states per rules.

**Acceptance criteria**

- [ ] Search by first or last name
- [ ] Button states match FR-SUP-01
- [ ] Empty state explained

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-10
**Frontend: supervisor Requests page and nav badge**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-SUP-03 |
| Stories | US-18, US-25 |
| Is blocked by | S6-05, S6-07 |
| Blocks | S6-13 |

**Description**

Pending requests with Accept/Decline; badge count in navigation visible only to supervisors.

**Acceptance criteria**

- [ ] Accept/Decline update the list and badge
- [ ] Stale request error handled gracefully

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-11
**Frontend: notification polling, badge and inbox page**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-NOT-02, FR-NOT-03 |
| Stories | US-25, US-26 |
| Is blocked by | S6-07, S1-11 |
| Blocks | S6-13 |

**Description**

TanStack Query polling about every 60 s plus refetch on window focus; badge; inbox with mark read and mark all.

**Acceptance criteria**

- [ ] No polling while the tab is hidden beyond focus refetch
- [ ] Badge updates after actions
- [ ] Inbox keyboard accessible

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-12
**Frontend: 'No active supervisor' banner and my-supervision controls**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | Medium |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-SUP-06, FR-SUP-04 |
| Stories | US-16, US-27 |
| Is blocked by | S6-09, S6-06 |
| Blocks | S6-13 |

**Description**

Banner linking to Find a supervisor when no accepted link; panel to see current supervisor, cancel pending request, end link.

**Acceptance criteria**

- [ ] Banner hidden when a link is accepted
- [ ] End link asks for confirmation

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S6-13
**Tests: DB constraint tests, cross-organization negatives, concurrency, E2E request-accept**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S6 Supervision and notifications |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | FR-SUP-02, FR-SUP-05, NFR-SEC-02, NFR-SEC-06 |
| Stories | US-14, US-18, US-25 |
| Is blocked by | S6-12, S6-10, S6-11, S6-08 |
| Blocks | - |

**Description**

Integration tests for constraints and races; negative tests for cross-org lookup/request; Playwright: request, accept, notification badge.

**Acceptance criteria**

- [ ] All negative tests pass
- [ ] Concurrent accept/cancel/org-change deterministic
- [ ] E2E passes

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
