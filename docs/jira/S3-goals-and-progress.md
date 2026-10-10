# S3: Goals and progress

> **Milestone:** M3 · **Tickets:** 7 · **Estimate:** 10.5 developer-days

## Slice goal
Goal cards with ruler-style progress bars, editable targets, and the approved/pending/rejected rules.

## Demo / acceptance of the slice
Goal bars reflect logged hours; changing a target updates the bar; pending hours show as a lighter segment.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S3-01](#s3-01) | Story | Migration: goals table with defaults and last_celebrated_percent | 1 | S2-01 |
| [S3-02](#s3-02) | Story | Progress aggregate queries | 1.5 | S3-01 |
| [S3-03](#s3-03) | Story | Goals API: progress and target updates | 1.5 | S3-02, S1-07 |
| [S3-04](#s3-04) | Task | Goal math unit tests | 1 | S3-02 |
| [S3-05](#s3-05) | Story | ProgressBar component with ruler ticks and approved/pending segments | 2 | S2-10 |
| [S3-06](#s3-06) | Story | Goal cards row, supervision split and target editing | 2 | S3-05, S3-03 |
| [S3-07](#s3-07) | Task | Tests: RTL, axe and E2E for goals (with approved-hours test seeding) | 1.5 | S3-06 |

---

### S3-01
**Migration: goals table with defaults and last_celebrated_percent**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S3 Goals and progress |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, db |
| Requirements | FR-GOAL-01, FR-GOAL-02 |
| Stories | US-09, US-10 |
| Is blocked by | S2-01 |
| Blocks | S3-02 |

**Description**

Create goals (unique user_id+goal_type, target_hours, last_celebrated_percent); defaults 1200/100/3000 and On-site with no target created when a user row is first bound.

**Acceptance criteria**

- [ ] Defaults exist for every active user
- [ ] Unique constraint enforced
- [ ] Targets must be positive when set

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-02
**Progress aggregate queries**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S3 Goals and progress |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db |
| Requirements | FR-GOAL-01, FR-GOAL-03, FR-GOAL-05 |
| Stories | US-09 |
| Is blocked by | S3-01 |
| Blocks | S3-03, S3-04, S7-09, S8-02 |

**Description**

Static sqlc query returning approved and pending minutes per goal type, supervision group/individual split, and on-site totals; rejected excluded.

**Acceptance criteria**

- [ ] Matches hand-computed fixtures
- [ ] Single query per request (no N+1)
- [ ] Uses (user_id, status) index (EXPLAIN reviewed)

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-03
**Goals API: progress and target updates**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S3 Goals and progress |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api |
| Requirements | FR-GOAL-02, FR-GOAL-03 |
| Stories | US-09, US-10 |
| Is blocked by | S3-02, S1-07 |
| Blocks | S3-06, S9-01 |

**Description**

OpenAPI plus GET /goals/progress and PUT /goals/{type} for own targets with validation.

**Acceptance criteria**

- [ ] Non-positive target returns 400
- [ ] On-site target cannot be set
- [ ] Another user's goals are not reachable

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-04
**Goal math unit tests**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S3 Goals and progress |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, test |
| Requirements | FR-GOAL-03 |
| Stories | US-09 |
| Is blocked by | S3-02 |
| Blocks | - |

**Description**

Table-driven tests for approved/pending/rejected inclusion, rounding, percent calculation, supervision combination.

**Acceptance criteria**

- [ ] Edge cases: zero entries, target change, over 100%
- [ ] Percent rounding rule documented

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-05
**ProgressBar component with ruler ticks and approved/pending segments**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S3 Goals and progress |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, a11y |
| Requirements | FR-GOAL-04, FR-GOAL-03 |
| Stories | US-09 |
| Is blocked by | S2-10 |
| Blocks | S3-06, S8-05 |

**Description**

Accessible bar: role=progressbar, aria-valuenow/max/valuetext, ticks at 25/50/75%, lighter pending segment, goal colors.

**Acceptance criteria**

- [ ] aria-valuetext reads '312 of 1200 hours approved, 20 pending'
- [ ] Contrast checks pass
- [ ] Reduced motion respected

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-06
**Goal cards row, supervision split and target editing**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S3 Goals and progress |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | FR-GOAL-01, FR-GOAL-02, FR-GOAL-05 |
| Stories | US-09, US-10 |
| Is blocked by | S3-05, S3-03 |
| Blocks | S3-07 |

**Description**

Cards for Direct, Supervision (with Group/Individual split), Total Activity and On-site; edit-target dialog.

**Acceptance criteria**

- [ ] Editing a target updates the bar immediately
- [ ] Invalid values show messages
- [ ] On-site card has no target

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S3-07
**Tests: RTL, axe and E2E for goals (with approved-hours test seeding)**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S3 Goals and progress |
| Priority | Medium |
| Estimate | 1.5 day(s) · 3 points |
| Labels | test, e2e |
| Requirements | FR-GOAL-03, FR-GOAL-04, NFR-A11Y-01 |
| Stories | US-09, US-10 |
| Is blocked by | S3-06 |
| Blocks | - |

**Description**

Until S7 exists, a dev-only seed helper marks entries approved; RTL/axe on cards; E2E changes a target.

**Acceptance criteria**

- [ ] Helper is unavailable in prod builds
- [ ] E2E passes
- [ ] axe clean

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
