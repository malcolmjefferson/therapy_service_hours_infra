# S10: Team schedules

> **Milestone:** M6 · **Tickets:** 8 · **Estimate:** 13 developer-days

## Slice goal
Read-only Monday to Friday schedules for peers with the same supervisor, showing only time and category.

## Demo / acceptance of the slice
Two peers see each other's week blocks; no client, notes, hours, on-site or status ever appears; non-peers are refused.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S10-01](#s10-01) | Task | OpenAPI: peer and schedule DTOs | 1 | S6-02, S2-03 |
| [S10-02](#s10-02) | Story | Peer relationship queries | 1.5 | S10-01, S5-08 |
| [S10-03](#s10-03) | Story | Peers search endpoint | 1.5 | S10-02, S1-07 |
| [S10-04](#s10-04) | Story | Week schedule endpoint with whitelisted DTO | 2 | S10-02, S10-01, S2-06 |
| [S10-05](#s10-05) | Story | Frontend: peer search and selection with URL state | 1.5 | S10-03, S1-11 |
| [S10-06](#s10-06) | Story | Frontend: Monday to Friday week grid and week picker | 2 | S10-05, S10-04 |
| [S10-07](#s10-07) | Story | Frontend: responsive day list and keyboard accessibility | 1.5 | S10-06 |
| [S10-08](#s10-08) | Task | Tests: DTO leak tests, non-peer access, E2E, axe | 2 | S10-07 |

---

### S10-01
**OpenAPI: peer and schedule DTOs**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api, security |
| Requirements | FR-SCH-03, FR-SCH-02, NFR-SEC-03 |
| Stories | US-38 |
| Is blocked by | S6-02, S2-03 |
| Blocks | S10-02, S10-04 |

**Description**

Spec GET /schedules/peers?search= and GET /schedules/{userId}?weekStart= with whitelisted schemas (date, start, end, category only), weekend count, 400 on non-Monday.

**Acceptance criteria**

- [ ] Schedule schema has no reference to the entry model
- [ ] Spectral clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-02
**Peer relationship queries**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db, security |
| Requirements | FR-SCH-01, NFR-SEC-01 |
| Stories | US-36 |
| Is blocked by | S10-01, S5-08 |
| Blocks | S10-03, S10-04 |

**Description**

Static queries: users sharing the same accepted supervisor; supervisor to accepted supervisees; deactivated excluded; search escaped and capped.

**Acceptance criteria**

- [ ] Non-peer excluded
- [ ] Ended-link peers excluded
- [ ] Wildcards literal

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-03
**Peers search endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-SCH-01 |
| Stories | US-36 |
| Is blocked by | S10-02, S1-07 |
| Blocks | S10-05 |

**Description**

GET /schedules/peers returns only the peer group (no global directory) with names; stricter throttling.

**Acceptance criteria**

- [ ] Result limited to peer group
- [ ] Tighter throttle configured

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-04
**Week schedule endpoint with whitelisted DTO**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, api, security |
| Requirements | FR-SCH-02, FR-SCH-03, FR-SCH-04, NFR-SEC-03 |
| Stories | US-37, US-38 |
| Is blocked by | S10-02, S10-01, S2-06 |
| Blocks | S10-06 |

**Description**

GET /schedules/{userId}?weekStart=: authorize peer relationship; return Monday to Friday blocks (date, start, end, category) only; hide rejected and needs-time; count weekend entries.

**Acceptance criteria**

- [ ] Response never contains client, notes, hours, on-site or status
- [ ] weekStart not Monday returns 400
- [ ] Non-peer returns 404
- [ ] Weekend count correct

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-05
**Frontend: peer search and selection with URL state**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend |
| Requirements | FR-SCH-01, FR-SCH-05 |
| Stories | US-36 |
| Is blocked by | S10-03, S1-11 |
| Blocks | S10-06 |

**Description**

Team Schedules page with search box, peer list, ?user= and ?week= URL state.

**Acceptance criteria**

- [ ] Reload restores selection
- [ ] No global directory shown

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-06
**Frontend: Monday to Friday week grid and week picker**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-SCH-02, FR-SCH-04, FR-SCH-05 |
| Stories | US-37 |
| Is blocked by | S10-05, S10-04 |
| Blocks | S10-07 |

**Description**

Time-block grid with category colors, previous/next/this week, 'N entries on weekend not shown' hint.

**Acceptance criteria**

- [ ] Defaults to current week
- [ ] Blocks placed at the right times
- [ ] Hint text exact

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-07
**Frontend: responsive day list and keyboard accessibility**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend, a11y |
| Requirements | FR-SCH-05, NFR-A11Y-01 |
| Stories | US-37 |
| Is blocked by | S10-06 |
| Blocks | S10-08 |

**Description**

Grid collapses to a day list on narrow screens; keyboard navigable; non-color cues for categories.

**Acceptance criteria**

- [ ] Usable at 360px width
- [ ] Tab/arrow navigation works
- [ ] axe clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S10-08
**Tests: DTO leak tests, non-peer access, E2E, axe**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S10 Team schedules |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | test, e2e, security |
| Requirements | NFR-SEC-03, NFR-SEC-06, FR-SCH-03 |
| Stories | US-38, US-37 |
| Is blocked by | S10-07 |
| Blocks | S11-01, S11-02, S11-04, S11-06, S11-10 |

**Description**

Go tests asserting banned fields never serialize (reflection and JSON golden), ended link, cross-org; Playwright path for two peers.

**Acceptance criteria**

- [ ] Leak test fails if a banned field is added
- [ ] E2E passes

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
