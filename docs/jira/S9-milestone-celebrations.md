# S9: Milestone celebrations

> **Milestone:** M5 · **Tickets:** 6 · **Estimate:** 9 developer-days

## Slice goal
One-time celebration banners and confetti at 25/50/75/100% of approved hours.

## Demo / acceptance of the slice
Approving hours past 25% celebrates once; reload and revert-then-reapprove never replay.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S9-01](#s9-01) | Task | OpenAPI: celebrations list and acknowledge | 1 | S3-03, S7-04 |
| [S9-02](#s9-02) | Story | Milestone computation service | 1.5 | S9-01 |
| [S9-03](#s9-03) | Story | Celebration endpoints with atomic acknowledge | 1.5 | S9-02 |
| [S9-04](#s9-04) | Story | Frontend: celebration banner and confetti | 2 | S2-10, S9-01 |
| [S9-05](#s9-05) | Story | Frontend: celebration orchestration on app load | 1.5 | S9-04, S9-03 |
| [S9-06](#s9-06) | Task | Tests: replay protection, revert and re-approve, E2E | 1.5 | S9-05 |

---

### S9-01
**OpenAPI: celebrations list and acknowledge**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | api |
| Requirements | FR-MS-01, FR-MS-02 |
| Stories | US-13 |
| Is blocked by | S3-03, S7-04 |
| Blocks | S9-02, S9-04 |

**Description**

GET /goals/celebrations returns uncelebrated crossed milestones per goal; POST /goals/celebrations/ack records the highest acknowledged percent.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Schema excludes On-site

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S9-02
**Milestone computation service**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend |
| Requirements | FR-MS-01, FR-MS-02 |
| Stories | US-13 |
| Is blocked by | S9-01 |
| Blocks | S9-03 |

**Description**

Compute highest newly crossed milestone (25/50/75/100) from approved hours versus last_celebrated_percent; never lowers the stored value (revert does not reset it).

**Acceptance criteria**

- [ ] Table-driven tests incl. multi-crossing, revert then re-approve, target change
- [ ] On-site never celebrates

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S9-03
**Celebration endpoints with atomic acknowledge**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api, db |
| Requirements | FR-MS-02 |
| Stories | US-13 |
| Is blocked by | S9-02 |
| Blocks | S9-05 |

**Description**

Conditional update of last_celebrated_percent (only increases); concurrent acks idempotent.

**Acceptance criteria**

- [ ] Two tabs acknowledging concurrently produce one celebration
- [ ] Value never decreases

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S9-04
**Frontend: celebration banner and confetti**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, a11y |
| Requirements | FR-MS-03 |
| Stories | US-13 |
| Is blocked by | S2-10, S9-01 |
| Blocks | S9-05 |

**Description**

Solid-color banner cycling gold, lime, red with the specified messages; confetti canvas disabled under prefers-reduced-motion; dismissible; focus managed.

**Acceptance criteria**

- [ ] No gradients
- [ ] Messages match CLAUDE.md §7.3
- [ ] Reduced motion shows banner only
- [ ] Contrast >= 4.5:1

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S9-05
**Frontend: celebration orchestration on app load**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-MS-01, FR-MS-02 |
| Stories | US-13 |
| Is blocked by | S9-04, S9-03 |
| Blocks | S9-06 |

**Description**

On load fetch celebrations, show them one at a time (highest per goal), acknowledge after display, never replay on reload.

**Acceptance criteria**

- [ ] Reload does not replay
- [ ] Failure to acknowledge does not loop forever
- [ ] Multiple goals queue in order

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S9-06
**Tests: replay protection, revert and re-approve, E2E**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S9 Milestone celebrations |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | test, e2e |
| Requirements | FR-MS-02, FR-MS-03 |
| Stories | US-13 |
| Is blocked by | S9-05 |
| Blocks | S11-05, S11-06 |

**Description**

Backend integration and Playwright: approve to cross 25%, celebrate once, reload, revert, re-approve.

**Acceptance criteria**

- [ ] No replay in any scenario
- [ ] E2E passes

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
