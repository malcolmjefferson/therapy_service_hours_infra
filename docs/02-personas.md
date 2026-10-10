# 02. User Personas

> All personas are **fictional**. Names, goals and scenarios are invented for design and test purposes. No real client or person is represented.

## P1. Maya Torres, Practicum Trainee (role: User)

| | |
|---|---|
| **Context** | Second-year counseling master's student, 20 to 25 hours a week at a community clinic. |
| **Tech comfort** | Comfortable with web apps; uses a laptop at the clinic and a phone for quick checks. |
| **Goals** | Log sessions quickly, see progress toward 1,200 direct hours, know which hours are approved, finish hours on time for licensure. |
| **Frustrations** | Re-typing the same client names; unsure whether hours were accepted; losing track of rejected entries. |
| **Needs from the app** | Fast entry form with saved clients, calculated hours, clear status chips with rejection reasons, milestone encouragement. |
| **Risks to design for** | Typing real client names in notes (warn), overlapping sessions (block), editing an approved entry by mistake (locked). |
| **Main stories** | US-01 to US-17, US-26, US-27 |

## P2. Dr. Priya Nair, Clinical Supervisor (roles: User + Supervisor)

| | |
|---|---|
| **Context** | Licensed supervisor overseeing six to eight trainees in the same organization. |
| **Tech comfort** | Moderate; wants few clicks and no surprises. |
| **Goals** | Accept supervisees, review entries in bulk, spot who is behind, undo an approval made in error. |
| **Frustrations** | Chasing paper logs; unclear which entries are new; no history of what she approved. |
| **Needs from the app** | Request inbox with badge, per-supervisee progress summary, bulk approve with skipped-entry report, reject with reason, revert with reason, history. |
| **Risks to design for** | Approving someone else's supervisee (IDOR), concurrent review actions (conditional updates), missing in-app-only notifications (badge and polling). |
| **Main stories** | US-18 to US-25 |

## P3. Sam Okafor, Organization Administrator (roles: User + Admin)

| | |
|---|---|
| **Context** | Program coordinator who onboards each cohort and handles staff changes. |
| **Tech comfort** | High with admin tools; cautious about irreversible actions. |
| **Goals** | Invite users with the right organization and roles, correct mistakes, deactivate leavers, keep an audit trail. |
| **Frustrations** | Accidentally orphaning supervision links, locking everyone out by demoting the last admin, unclear consequences of moving a user. |
| **Needs from the app** | Admin console with confirmations that state consequences, two-step delete, audit log. |
| **Constraint** | Admin has **no** access to anyone's entries or notes. |
| **Main stories** | US-28 to US-35 |

## P4. Jordan Lee, Peer Trainee (role: User)

| | |
|---|---|
| **Context** | Trainee under the same supervisor as Maya; coordinates room and supervision time with peers. |
| **Goals** | See when peers are on site, in what kind of activity, without seeing private details. |
| **Needs** | Search within the peer group, week view Monday to Friday, shareable URL, mobile-friendly day list. |
| **Risks to design for** | Leakage of client names, notes, hours, approval state (whitelisted DTO), viewing non-peers (authz). |
| **Main stories** | US-36 to US-38 |

## P5. Riley, Platform Owner and Operator

| | |
|---|---|
| **Context** | The developer who builds and runs the app (the project owner). Also the first admin. |
| **Goals** | Safe, repeatable releases; stay under $50/month; know when something breaks; recover from mistakes. |
| **Needs** | One pipeline with manual prod approval, migrations that cannot break running code, alarms by email, runbook, budget guard. |
| **Main stories** | US-39 to US-46 |

## Persona to slice map

| Persona | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| P1 Maya | | ● | ● | ● | ● | | ● | ● | | ● | ● | ● |
| P2 Priya | | ● | | | | | ● | ● | ● | | ○ | ● |
| P3 Sam | | ● | | | | ● | | | | | | ● |
| P4 Jordan | | ● | | | | | ● | | | | ● | |
| P5 Riley | ● | ● | | | | ○ | | | | | | ● |

● primary · ○ secondary
