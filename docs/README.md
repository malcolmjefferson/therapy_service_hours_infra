# Therapy Service Hours Tracker: Planning Pack

Built from `CLAUDE.md` (planning interview, 2026-10-09). Work is organized into **12 vertical slices**, each ending in something you can run and verify on dev.

| # | Document | What it is |
|---|---|---|
| 01 | [Requirements specification](01-requirements-specification.md) | Numbered functional, non-functional and business requirements; assumptions and open questions |
| 02 | [Personas](02-personas.md) | Five fictional personas |
| 03 | [User stories](03-user-stories.md) | 46 stories with acceptance criteria |
| 04 | [Architecture diagrams](04-architecture-diagrams.md) | Mermaid: components, pipeline, internals, sequence, states, ER, slice graph |
| 05 | [Execution plan](05-execution-plan.md) | Slices, milestones, gates, timeline scenarios, risks |
| 06 | [Validation plan](06-validation-plan.md) | Test layers, gates, per-slice exit checks, security validation |
| 08 | [Traceability matrix](08-traceability-matrix.md) | Generated: every requirement and story to its tickets |
| — | [Jira ticket drafts](jira/README.md) | 146 tickets in 12 slice files plus `tickets.csv` |
| — | [ADRs](adr/README.md) | Six decision records for the Recommended designs (all Accepted) |
| — | [Engineering standards](standards/README.md) | Go and React coding standards (with SOLID), architecture and security standards |

## The slices

| Slice | Name | Milestone |
|---|---|---|
| S0 | Walking skeleton | M1 |
| S1 | Secure sign-in | M2 |
| S2 | Log hours | M3 |
| S3 | Goals and progress | M3 |
| S4 | Import and export | M3 |
| S5 | Organizations and admin console | M4 |
| S6 | Supervision and notifications | M4 |
| S7 | Review workflow | M5 |
| S8 | Supervisor dashboard | M5 |
| S9 | Milestone celebrations | M5 |
| S10 | Team schedules | M6 |
| S11 | Hardening and go-live | M6 |

## Read in this order

1. `01` requirements, then `adr/README.md` (the accepted decisions)
2. `standards/README.md` (the rules every PR is reviewed against)
3. `05` execution plan and `06` validation plan
4. `jira/S0-walking-skeleton.md` to start building

## Decisions recorded

- **ADR-0001 to ADR-0006 accepted** on 2026-10-10. `CLAUDE.md` still needs the refinements listed in `adr/README.md` (ticket S0-02).
- **ASM-01 to ASM-07 confirmed**; **OQ-01** decided as Google sign-in only; **OQ-02** and **OQ-03** decided (`01-requirements-specification.md` §7).
- **Still to do (owner-only):** the actions listed in `jira/README.md`: authorize CodeConnections, confirm the SNS email, create the Google OAuth client.

## Data and conventions

- All personas, names and fixtures are **fictional**; the only real value is the first-admin email already recorded in CLAUDE.md.
- Estimates are developer-days before any code exists: **re-baseline after M1**.
- Regenerate `jira/*.md`, `tickets.csv` and `08-traceability-matrix.md` from the ticket data if tickets change; do not hand-edit generated files.
