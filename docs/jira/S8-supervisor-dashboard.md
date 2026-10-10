# S8: Supervisor dashboard

> **Milestone:** M5 · **Tickets:** 7 · **Estimate:** 12 developer-days

## Slice goal
Pick a supervisee, see per-goal progress, pending and rejected counts, and drill into entries to act.

## Demo / acceptance of the slice
A supervisor sees accurate summaries for accepted supervisees only and reviews from the drill-down.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S8-01](#s8-01) | Story | Supervisees list endpoint with pending counts | 1.5 | S7-04, S6-05 |
| [S8-02](#s8-02) | Story | Supervisee summary endpoint | 2 | S8-01, S3-02, S1-07 |
| [S8-03](#s8-03) | Story | Supervisee entries endpoint | 1.5 | S8-02, S7-03 |
| [S8-04](#s8-04) | Story | Frontend: supervisee list and selector | 1.5 | S8-01, S1-11 |
| [S8-05](#s8-05) | Story | Frontend: supervisee summary cards | 1.5 | S8-04, S3-05, S8-02 |
| [S8-06](#s8-06) | Story | Frontend: drill-down entries list with review actions | 2 | S8-05, S8-03, S7-12 |
| [S8-07](#s8-07) | Task | Tests: authz negatives, E2E and axe for the dashboard | 2 | S8-06 |

---

### S8-01
**Supervisees list endpoint with pending counts**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-DASH-01, FR-DASH-03 |
| Stories | US-19 |
| Is blocked by | S7-04, S6-05 |
| Blocks | S8-02, S8-04 |

**Description**

OpenAPI plus GET /supervisees returning accepted supervisees (name, pending count, last entry date) via a supervisor DTO; SQL aggregates.

**Acceptance criteria**

- [ ] Only accepted links listed
- [ ] Pending counts correct
- [ ] Paginated

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-02
**Supervisee summary endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, security |
| Requirements | FR-DASH-01, NFR-SEC-02 |
| Stories | US-19 |
| Is blocked by | S8-01, S3-02, S1-07 |
| Blocks | S8-03, S8-05 |

**Description**

GET /supervisees/{id}/summary: per-goal approved vs pending hours, pending and rejected counts, last entry date, reusing the S3 aggregates scoped by the authz relationship check.

**Acceptance criteria**

- [ ] Non-supervisee returns 404
- [ ] Ended link returns 404
- [ ] Numbers equal the supervisee's own progress view

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-03
**Supervisee entries endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-DASH-02, NFR-SEC-01 |
| Stories | US-20 |
| Is blocked by | S8-02, S7-03 |
| Blocks | S8-06 |

**Description**

GET /supervisees/{id}/entries with filters, sort allowlist, pagination (reuses S7-03 query shape); notes visible to supervisors by design.

**Acceptance criteria**

- [ ] Sort allowlist enforced
- [ ] Cross-supervisor access refused
- [ ] Pagination default 50

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-04
**Frontend: supervisee list and selector**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-DASH-01, FR-DASH-03 |
| Stories | US-19 |
| Is blocked by | S8-01, S1-11 |
| Blocks | S8-05 |

**Description**

Supervisees page sorted by pending count with search; selecting opens the detail view (URL-driven).

**Acceptance criteria**

- [ ] Deep link to a supervisee works
- [ ] Empty state when no supervisees

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-05
**Frontend: supervisee summary cards**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-DASH-01 |
| Stories | US-19 |
| Is blocked by | S8-04, S3-05, S8-02 |
| Blocks | S8-06 |

**Description**

Read-only goal cards (reusing ProgressBar) plus counts and last entry date.

**Acceptance criteria**

- [ ] Matches API values
- [ ] aria-valuetext correct

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-06
**Frontend: drill-down entries list with review actions**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-DASH-02, FR-REV-01, FR-REV-02, FR-REV-03 |
| Stories | US-20, US-21, US-22, US-23 |
| Is blocked by | S8-05, S8-03, S7-12 |
| Blocks | S8-07 |

**Description**

Entries table for the selected supervisee with filters, sorting, pagination and approve/reject/bulk/revert via S7 components.

**Acceptance criteria**

- [ ] Actions update summary and list
- [ ] Reasons required where specified

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S8-07
**Tests: authz negatives, E2E and axe for the dashboard**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S8 Supervisor dashboard |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | NFR-SEC-06, FR-DASH-01, FR-DASH-02 |
| Stories | US-19, US-20 |
| Is blocked by | S8-06 |
| Blocks | S11-01, S11-04 |

**Description**

Non-supervisee, ended-link and cross-org negatives; Playwright path from supervisee list to approval; axe.

**Acceptance criteria**

- [ ] Negatives pass
- [ ] E2E passes
- [ ] axe clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
