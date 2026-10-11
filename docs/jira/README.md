# Jira ticket drafts

**153 tickets** in **12 epics** (one per vertical slice). Every ticket is **2 days or less**, has acceptance criteria, a Definition of Done, dependencies, and links to requirements and stories.

## Files

| File | Contents |
|---|---|
| [S0-walking-skeleton.md](S0-walking-skeleton.md) | Pipeline, infra, health page (21 tickets) |
| [S1-secure-sign-in.md](S1-secure-sign-in.md) | Cognito + Google, invites, authz framework (20) |
| [S2-log-hours.md](S2-log-hours.md) | Entries, clients, table (17) |
| [S3-goals-and-progress.md](S3-goals-and-progress.md) | Goal cards and progress (7) |
| [S4-import-and-export.md](S4-import-and-export.md) | Markdown import, MD/CSV/PDF export (11) |
| [S5-organizations-and-admin-console.md](S5-organizations-and-admin-console.md) | Orgs, users, roles, workflows (16) |
| [S6-supervision-and-notifications.md](S6-supervision-and-notifications.md) | Requests, links, notifications (13) |
| [S7-review-workflow.md](S7-review-workflow.md) | Approve, reject, bulk, revert (14) |
| [S8-supervisor-dashboard.md](S8-supervisor-dashboard.md) | Supervisee summaries and drill-down (7) |
| [S9-milestone-celebrations.md](S9-milestone-celebrations.md) | One-time celebrations (6) |
| [S10-team-schedules.md](S10-team-schedules.md) | Peer week view (8) |
| [S11-hardening-and-go-live.md](S11-hardening-and-go-live.md) | Security suites, perf, a11y, runbook, guide, release (13) |
| [tickets.csv](tickets.csv) | Import file for Jira (see below) |

## Ticket template

| Field | Meaning |
|---|---|
| **ID** | `S<slice>-<nn>`, stable draft id; becomes the first words of the Jira summary |
| **Issue Type** | Story (user-visible or behavior), Task (supporting work), Spike (time-boxed investigation), Epic (the slice) |
| **Priority** | Highest (on the critical path or security-critical), High, Medium |
| **Estimate** | Developer-days (0.5 to 2) and story points (0.5d=1, 1d=2, 1.5d=3, 2d=5) |
| **Labels** | `backend`, `frontend`, `infra`, `db`, `api`, `security`, `test`, `e2e`, `a11y`, `docs`, `adr-000x`, plus the slice id |
| **Requirements / Stories** | Links to `01-requirements-specification.md` and `03-user-stories.md` |
| **Is blocked by / Blocks** | Dependencies, as ticket ids |
| **Acceptance criteria** | Checkable statements; each is testable |

## Definition of Done (applies to every ticket)

1. **Implementation:** code or design merged to `main` via PR.
2. **Validation:** automated tests pass in the pipeline; manual steps listed in the ticket (if any) are done.
3. **Documentation:** the PR explains how a reviewer verifies it; `api/openapi.yaml` is changed **first** when a contract changes; `CLAUDE.md` is updated when a decision changes.

Plus the standing rules: bound parameters only, authz through `internal/authz`, pseudonyms only in fixtures and logs, no secrets committed, budget guard respected.

## Importing into Jira

`tickets.csv` uses Jira's CSV importer conventions: `Issue Id` (numeric), `Issue Type`, `Summary`, `Description`, `Priority`, `Parent Id` (links stories to their epic), repeated `Labels` columns, `Original Estimate`, `Story Points`, and repeated `Outward issue link (Blocks)` columns that point to other `Issue Id` values. A `Draft ID` column keeps the original ids. Field mapping screens differ between Jira projects (for example the Epic Link versus Parent field and the name of the story-points field), so map columns in the importer's wizard and try a 5-row import first.

## Totals

| Slice | Tickets | Dev-days |
|---|--:|--:|
| S0 Walking skeleton | 21 | 32 |
| S1 Secure sign-in | 20 | 23.5 |
| S2 Log hours | 17 | 29 |
| S3 Goals and progress | 7 | 10.5 |
| S4 Import and export | 11 | 17 |
| S5 Admin console | 16 | 28 |
| S6 Supervision and notifications | 13 | 23 |
| S7 Review workflow | 14 | 22 |
| S8 Supervisor dashboard | 7 | 12 |
| S9 Milestone celebrations | 6 | 9 |
| S10 Team schedules | 8 | 13 |
| S11 Hardening and go-live | 13 | 20.5 |
| **Total** | **153** | **239.5** |

Type mix: 94 Stories, 51 Tasks, 1 Spike. Priority mix: 39 Highest, 91 High, 16 Medium.

## Owner actions (cannot be done by Claude Code)

- Create the three private GitHub repos and authorize AWS CodeConnections (S0-01).
- Confirm the SNS email subscription once (S0-18).
- Create the Google OAuth client and provide its id and secret (S1-01).
- Approve the prod stage in the pipeline (S0-16 onward).
