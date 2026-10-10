# S2: Log hours

> **Milestone:** M3 · **Tickets:** 17 · **Estimate:** 29 developer-days

## Slice goal
The core product for one user: log sessions with start and end times, save clients, and browse them in the entries table.

## Demo / acceptance of the slice
Sign in, add clients, log entries (including an overlap attempt that is blocked), sort, filter, edit, delete.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S2-01](#s2-01) | Story | Migration: categories, clients, entries, entry_clients with DB constraints | 2 | S1-04 |
| [S2-02](#s2-02) | Story | sqlc queries for categories, clients and entries | 2 | S2-01 |
| [S2-03](#s2-03) | Task | OpenAPI: categories, clients, entries | 1 | S2-01 |
| [S2-04](#s2-04) | Story | Entry validation service | 1.5 | S2-03 |
| [S2-05](#s2-05) | Story | Create, update and delete entry endpoints with authz and overlap mapping | 2 | S2-02, S2-04, S1-07 |
| [S2-06](#s2-06) | Story | List entries endpoint: filters, sort allowlist, pagination, LIKE escaping | 2 | S2-02, S2-03, S1-07 |
| [S2-07](#s2-07) | Story | Clients API with case-insensitive uniqueness | 1.5 | S2-02, S2-03, S1-07 |
| [S2-08](#s2-08) | Task | Categories endpoint | 0.5 | S2-02, S2-03 |
| [S2-09](#s2-09) | Story | Idempotency-Key middleware | 2 | S2-05 |
| [S2-10](#s2-10) | Story | Frontend component library port from prototype | 2 | S0-13 |
| [S2-11](#s2-11) | Story | Entry form: date, category, start/end, read-only hours, on-site, notes | 2 | S2-10, S2-03, S2-05 |
| [S2-12](#s2-12) | Story | Client multi-select dropdown with inline + add | 2 | S2-10, S2-07 |
| [S2-13](#s2-13) | Story | Entries table: sorting, badges, client lines, empty states, pagination | 2 | S2-10, S2-06 |
| [S2-14](#s2-14) | Story | Table filters, Clear filters and resizable columns | 2 | S2-13 |
| [S2-15](#s2-15) | Story | Edit and delete flows with confirmation and overlap error UX | 1.5 | S2-11, S2-13 |
| [S2-16](#s2-16) | Task | Tests: Testcontainers integration, injection payloads, MSW/RTL, axe | 2 | S2-15, S2-14 |
| [S2-17](#s2-17) | Task | E2E: log an entry critical path | 1 | S2-16, S1-13 |

---

### S2-01
**Migration: categories, clients, entries, entry_clients with DB constraints**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db |
| Requirements | FR-LOG-04, FR-LOG-07, FR-LOG-03 |
| Stories | US-03, US-04 |
| Is blocked by | S1-04 |
| Blocks | S2-02, S2-03, S3-01, S7-01 |

**Description**

Create tables per CLAUDE.md §9 including times from day one: end>start, both-null-or-both-set, duration_minutes consistency, divisible by 15, btree_gist exclusion per user for non-rejected entries with times, index (user_id, session_date, start_time); seed the 12 categories.

**Acceptance criteria**

- [ ] Overlapping insert is rejected by the DB (exclusion violation)
- [ ] Constraint tests for each rule
- [ ] Seed categories match CLAUDE.md §8 in group and order

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-02
**sqlc queries for categories, clients and entries**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db, security |
| Requirements | NFR-SEC-01, FR-LOG-08 |
| Stories | US-07 |
| Is blocked by | S2-01 |
| Blocks | S2-05, S2-06, S2-07, S2-08 |

**Description**

Static queries: insert/update/delete entry (own only), list with optional filters via named params, separate fixed queries per allowed sort, client list/insert, category list. No dynamic SQL.

**Acceptance criteria**

- [ ] sqlc generate clean and committed
- [ ] Semgrep rule passes
- [ ] Optional filters use named params
- [ ] Sort handled by allowlist mapping to fixed queries

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-03
**OpenAPI: categories, clients, entries**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api |
| Requirements | NFR-DOC-01, FR-LOG-02 |
| Stories | US-03 |
| Is blocked by | S2-01 |
| Blocks | S2-04, S2-06, S2-07, S2-08, S2-11, S4-01, S10-01 |

**Description**

Spec CRUD, list parameters (group, client text, from/to, sort, dir, page), 409 overlap problem type, Idempotency-Key on POST, hours is read-only and absent from request schemas.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Request schema forbids unknown fields
- [ ] Generated client compiles

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-04
**Entry validation service**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend |
| Requirements | FR-LOG-02, FR-LOG-03, FR-LOG-10 |
| Stories | US-03 |
| Is blocked by | S2-03 |
| Blocks | S2-05 |

**Description**

Validate 15-minute steps, end after start, no midnight crossing, required fields, field lengths; compute duration_minutes; reject any client-sent hours; table-driven tests.

**Acceptance criteria**

- [ ] Boundary cases (23:45 to 00:00 rejected, 00:00 to 00:15 accepted)
- [ ] Unknown field 'hours' returns 400
- [ ] Hours 1.25 for 75 minutes

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-05
**Create, update and delete entry endpoints with authz and overlap mapping**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, security |
| Requirements | FR-LOG-01, FR-LOG-04, FR-LOG-05 |
| Stories | US-03, US-04, US-08 |
| Is blocked by | S2-02, S2-04, S1-07 |
| Blocks | S2-09, S2-11, S4-03, S7-07 |

**Description**

Handlers call authz (own entries, status pending/rejected), map exclusion violation 23P01 to 409 problem naming the conflicting session, update/delete own entries.

**Acceptance criteria**

- [ ] Other user's entry id returns 404
- [ ] Overlap returns 409 with conflicting date/time
- [ ] Concurrent overlapping creates: exactly one succeeds

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-06
**List entries endpoint: filters, sort allowlist, pagination, LIKE escaping**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, security |
| Requirements | FR-LOG-08, NFR-SEC-01 |
| Stories | US-07 |
| Is blocked by | S2-02, S2-03, S1-07 |
| Blocks | S2-13, S4-06, S10-04 |

**Description**

GET /entries with group, client text (wildcards escaped, length capped), date range, sort/dir allowlist (else 400), page size default 50, default newest first, category sort by group then name.

**Acceptance criteria**

- [ ] Invalid sort returns 400
- [ ] % and _ in client filter match literally
- [ ] Pagination stable under equal dates

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-07
**Clients API with case-insensitive uniqueness**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-LOG-06 |
| Stories | US-05 |
| Is blocked by | S2-02, S2-03, S1-07 |
| Blocks | S2-12 |

**Description**

List/create/rename/delete own clients; unique (user_id, lower(name)); deletion of a client used by entries is handled (detach with confirmation flag).

**Acceptance criteria**

- [ ] Creating 'a.b.' when 'A.B.' exists returns the existing client or 409 (documented)
- [ ] Cannot touch another user's clients

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-08
**Categories endpoint**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S2 Log hours |
| Priority | Medium |
| Estimate | 0.5 day(s) · 1 points |
| Labels | backend, api |
| Requirements | FR-LOG-07 |
| Stories | US-03 |
| Is blocked by | S2-02, S2-03 |
| Blocks | - |

**Description**

GET /categories returns grouped lookup data with Cache-Control.

**Acceptance criteria**

- [ ] Returns 12 categories in order
- [ ] Cacheable response headers

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-09
**Idempotency-Key middleware**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Medium |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api |
| Requirements | FR-LOG-01, NFR-DOC-01 |
| Stories | US-03 |
| Is blocked by | S2-05 |
| Blocks | S4-04, S7-05 |

**Description**

Store key, actor, request hash and response in an idempotency table (Postgres, no extra service) with TTL cleanup; replay returns the original response; mismatched hash returns 422.

**Acceptance criteria**

- [ ] Same key twice creates one entry
- [ ] Different payload with same key returns 422
- [ ] Expired keys purged by a scheduled cleanup

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-10
**Frontend component library port from prototype**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, ux |
| Requirements | NFR-UX-01, NFR-A11Y-01, FR-LOG-10 |
| Stories | US-03 |
| Is blocked by | S0-13 |
| Blocks | S2-11, S2-12, S2-13, S3-05, S7-12, S9-04 |

**Description**

Button (primary/ghost), grouped Select, Toast, Badge (group colors), Dialog, form field with label and error, using theme tokens; Storybook-free but with RTL tests.

**Acceptance criteria**

- [ ] Contrast of all text/background pairs at least 4.5:1 (test)
- [ ] Focus ring red-deep 2px
- [ ] prefers-reduced-motion respected

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-11
**Entry form: date, category, start/end, read-only hours, on-site, notes**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-LOG-01, FR-LOG-02, FR-LOG-03, FR-LOG-09, FR-LOG-10 |
| Stories | US-03, US-06 |
| Is blocked by | S2-10, S2-03, S2-05 |
| Blocks | S2-15 |

**Description**

Port prototype form order; time inputs in 15-minute steps; calculated hours displayed read-only; pseudonym warning on notes; inline errors and toast.

**Acceptance criteria**

- [ ] Add entry works by click and Enter
- [ ] Hours update live
- [ ] Warning text visible
- [ ] Errors announced to screen readers

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-12
**Client multi-select dropdown with inline + add**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, ux |
| Requirements | FR-LOG-06, FR-LOG-09 |
| Stories | US-05, US-06 |
| Is blocked by | S2-10, S2-07 |
| Blocks | - |

**Description**

Checkbox multi-select dropdown (not a list box) with a + button that opens an inline full-width input; pseudonym warning; keyboard accessible.

**Acceptance criteria**

- [ ] Select several clients
- [ ] Duplicates differing in case are not created
- [ ] Input is never clipped

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-13
**Entries table: sorting, badges, client lines, empty states, pagination**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-LOG-08 |
| Stories | US-07 |
| Is blocked by | S2-10, S2-06 |
| Blocks | S2-14, S2-15, S7-10 |

**Description**

Sortable headers as real buttons with aria-sort, group badges, one client per line, empty and no-match states, pagination, default newest first.

**Acceptance criteria**

- [ ] Sort toggles asc/desc per column
- [ ] aria-sort correct
- [ ] Pagination works against the API

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-14
**Table filters, Clear filters and resizable columns**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | Medium |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, ux |
| Requirements | FR-LOG-08 |
| Stories | US-07 |
| Is blocked by | S2-13 |
| Blocks | S2-16 |

**Description**

Filter by group, client text, date range; Clear filters on the Entries header row with Export/Import placeholders; percentage-width resizable columns.

**Acceptance criteria**

- [ ] Filters combine
- [ ] Clear resets all
- [ ] Resizing keeps total width at 100%

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-15
**Edit and delete flows with confirmation and overlap error UX**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-LOG-05, FR-LOG-04 |
| Stories | US-04, US-08 |
| Is blocked by | S2-11, S2-13 |
| Blocks | S2-16, S4-05 |

**Description**

Edit populates the form; delete asks for confirmation; overlap conflict error appears inline naming the clashing session.

**Acceptance criteria**

- [ ] Editing preserves unchanged values
- [ ] Overlap message matches US-04
- [ ] Delete confirmation is keyboard accessible

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-16
**Tests: Testcontainers integration, injection payloads, MSW/RTL, axe**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test |
| Requirements | NFR-SEC-01, NFR-A11Y-01, FR-LOG-04 |
| Stories | US-03, US-04, US-07 |
| Is blocked by | S2-15, S2-14 |
| Blocks | S2-17 |

**Description**

Go integration tests against real PostgreSQL for constraints, overlap, authz on entries/clients; injection payloads on client filter, sort, notes; RTL+MSW for form and table; axe on the entries page.

**Acceptance criteria**

- [ ] Injection payloads leave tables intact and return clean 4xx or literal matches
- [ ] Concurrent overlap test
- [ ] axe has no serious or critical violations

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S2-17
**E2E: log an entry critical path**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S2 Log hours |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | e2e |
| Requirements | FR-LOG-01, FR-LOG-04, FR-LOG-05 |
| Stories | US-03, US-04, US-08 |
| Is blocked by | S2-16, S1-13 |
| Blocks | - |

**Description**

Playwright: sign in, add client, log an entry, see it in the table, attempt an overlap, edit and delete.

**Acceptance criteria**

- [ ] Passes in the dev smoke stage
- [ ] Uses fictional pseudonyms only

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
