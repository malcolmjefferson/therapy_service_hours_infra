# S4: Import and export

> **Milestone:** M3 · **Tickets:** 11 · **Estimate:** 17 developer-days

## Slice goal
Bring in the prototype ledger (marked Needs time) and take data out as Markdown, CSV and PDF.

## Demo / acceptance of the slice
Import a prototype file and see the report; export all three formats; re-import the Markdown export with identical results.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S4-01](#s4-01) | Task | OpenAPI: import and export endpoints | 1 | S2-03 |
| [S4-02](#s4-02) | Story | Markdown ledger parser (both layouts) | 2 | S4-01 |
| [S4-03](#s4-03) | Story | Import service: transactional parameterized inserts, client merge, Needs time | 2 | S4-02, S2-05 |
| [S4-04](#s4-04) | Story | Import endpoint with limits | 1.5 | S4-03, S2-09 |
| [S4-05](#s4-05) | Story | Needs-time entries: add times via edit, badge, overlap exemption | 1.5 | S4-03, S2-15 |
| [S4-06](#s4-06) | Story | Export data endpoint | 1 | S4-01, S2-06 |
| [S4-07](#s4-07) | Story | Markdown export (round-trippable) shared serializer | 1.5 | S4-06 |
| [S4-08](#s4-08) | Story | CSV export with formula-injection protection | 1 | S4-06 |
| [S4-09](#s4-09) | Story | PDF export in the browser | 2 | S4-06 |
| [S4-10](#s4-10) | Story | Import dialog and report UI | 1.5 | S4-04 |
| [S4-11](#s4-11) | Task | Tests: corpus, round trip, crafted injection rows, E2E import | 2 | S4-10, S4-07, S4-08, S4-05 |

---

### S4-01
**OpenAPI: import and export endpoints**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api |
| Requirements | FR-IO-01, FR-IO-04 |
| Stories | US-11, US-12 |
| Is blocked by | S2-03 |
| Blocks | S4-02, S4-06 |

**Description**

Spec POST /import/markdown (size limits, report schema) and GET /export/entries (paged, all fields incl. times).

**Acceptance criteria**

- [ ] Report schema lists imported, merged clients, skipped rows with reasons
- [ ] Spectral clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-02
**Markdown ledger parser (both layouts)**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, parser |
| Requirements | FR-IO-01, FR-IO-03 |
| Stories | US-11 |
| Is blocked by | S4-01 |
| Blocks | S4-03 |

**Description**

Parse the prototype format into typed values: Clients/Groups section, entries table with or without Start/End, escaped pipes, '; ' multi-client, '—' none, old single-client files; per-row errors.

**Acceptance criteria**

- [ ] Golden files from the prototype parse correctly
- [ ] Fuzz test does not panic
- [ ] Unicode and long cells handled

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-03
**Import service: transactional parameterized inserts, client merge, Needs time**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db |
| Requirements | FR-IO-02, FR-IO-03 |
| Stories | US-11 |
| Is blocked by | S4-02, S2-05 |
| Blocks | S4-04, S4-05 |

**Description**

Insert entries without times as needs_time with duration from Hours; merge clients case-insensitively; skip exact duplicates (assumption ASM-07); all in one transaction with a report.

**Acceptance criteria**

- [ ] Re-importing the same file adds nothing and reports skipped
- [ ] Bad rows are reported, valid rows kept (documented policy)
- [ ] Rows with times obey overlap rules

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-04
**Import endpoint with limits**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api, security |
| Requirements | FR-IO-01, FR-IO-03, NFR-SEC-01 |
| Stories | US-11 |
| Is blocked by | S4-03, S2-09 |
| Blocks | S4-10 |

**Description**

Multipart upload, 1 MB limit, 5,000-row cap, content-type checks, authz own data only, Idempotency-Key.

**Acceptance criteria**

- [ ] Oversize file returns 413 problem
- [ ] Non-Markdown returns 400
- [ ] Injection-like cell content stored as plain text

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-05
**Needs-time entries: add times via edit, badge, overlap exemption**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | Medium |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, frontend |
| Requirements | FR-IO-02 |
| Stories | US-17 |
| Is blocked by | S4-03, S2-15 |
| Blocks | S4-11 |

**Description**

Editing a needs_time entry requires times and clears the flag; hours recalculate; table shows a 'Needs time' badge; overlap check ignores legacy entries.

**Acceptance criteria**

- [ ] Flag clears on valid times
- [ ] Hours change from legacy to calculated
- [ ] Badge visible and announced

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-06
**Export data endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, api |
| Requirements | FR-IO-04 |
| Stories | US-12 |
| Is blocked by | S4-01, S2-06 |
| Blocks | S4-07, S4-08, S4-09 |

**Description**

Paged, ownership-scoped export of all own entries with times, clients and status.

**Acceptance criteria**

- [ ] Returns only own entries
- [ ] Page size cap enforced
- [ ] Includes Start and End

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-07
**Markdown export (round-trippable) shared serializer**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-IO-04 |
| Stories | US-12 |
| Is blocked by | S4-06 |
| Blocks | S4-11 |

**Description**

Frontend serializer to the prototype format plus Start/End columns, escaping pipes, '; ' client joins.

**Acceptance criteria**

- [ ] Export then import yields identical entries (property test)
- [ ] Header documented

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-08
**CSV export with formula-injection protection**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | frontend, security |
| Requirements | FR-IO-05 |
| Stories | US-12 |
| Is blocked by | S4-06 |
| Blocks | S4-11 |

**Description**

Neutralize cells starting with = + - @ tab or CR; RFC 4180 quoting; UTF-8 BOM option.

**Acceptance criteria**

- [ ] Cell '=1+1' is exported as text
- [ ] Commas/quotes/newlines preserved

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-09
**PDF export in the browser**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | Medium |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-IO-06 |
| Stories | US-12 |
| Is blocked by | S4-06 |
| Blocks | - |

**Description**

Lazy-loaded PDF generation (no server call) with goal summary and entries table including times; fonts embedded.

**Acceptance criteria**

- [ ] No network request during generation
- [ ] Multi-page tables paginate
- [ ] Bundle size increase documented and lazy

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-10
**Import dialog and report UI**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-IO-01, FR-IO-02, FR-IO-03 |
| Stories | US-11 |
| Is blocked by | S4-04 |
| Blocks | S4-11 |

**Description**

Import and Export buttons on the Entries header row; file picker, progress, report with skipped-row reasons.

**Acceptance criteria**

- [ ] Errors readable
- [ ] Keyboard accessible
- [ ] Report downloadable as text

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S4-11
**Tests: corpus, round trip, crafted injection rows, E2E import**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S4 Import and export |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | FR-IO-01, FR-IO-03, FR-IO-04, FR-IO-05, NFR-SEC-01 |
| Stories | US-11, US-12 |
| Is blocked by | S4-10, S4-07, S4-08, S4-05 |
| Blocks | S11-02 |

**Description**

Go tests with prototype-generated corpus and malicious rows; frontend round-trip; Playwright import of a prototype file.

**Acceptance criteria**

- [ ] Crafted rows with quotes, backslashes, % _ and SQL keywords import literally
- [ ] E2E passes

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
