# 01. Requirements Specification: Therapy Service Hours Tracker

> **Status:** Draft for owner review · **Date:** 2026-10-09
> **Source of truth for decisions:** `CLAUDE.md` (planning interview, 2026-10-09). This document turns those decisions into numbered, testable requirements. Where an ADR in `docs/adr/` refines or deviates from `CLAUDE.md`, the ADR wins once **Accepted**, and `CLAUDE.md` must then be updated.

## 1. Purpose and scope

A hosted web app where therapy trainees log service hours against licensure goals. Supervisors review and approve the hours. Admins manage users, roles and organizations.

It replaces the single-file prototype `therapy-hours-tracker.html`. The prototype's UX is preserved (see CLAUDE.md §12.1).

**In scope (v1):** invite-only Google sign-in, hour logging with start and end times, clients, goals and progress, milestone celebrations, Markdown import, Markdown/CSV/PDF export, organizations, admin console, supervision requests, review workflow (approve, reject, bulk, revert), supervisor dashboard, peer team schedules, in-app notifications.

**Out of scope (v1):** email notifications, custom domain, multiple supervisors per user, multi-organization membership, HIPAA-grade controls (no real client identifiers are stored), multi-region, mobile apps, preview deploys.

## 2. Conventions

- **ID scheme:** `FR-<area>-NN` functional · `NFR-<area>-NN` non-functional · `BR-NN` business rule · `US-NN` user story · `OQ-NN` open question · `ASM-NN` assumption.
- **Priority:** **Must** (v1 blocker) · **Should** (v1 target, can slip) · **Could**.
- **Status marker** (from CLAUDE.md): **Decided** · **Default** (owner may change) · **Recommended** (needs ADR).
- **Slice** = vertical unit of work (S0 to S11) defined in `05-execution-plan.md`. Every requirement maps to exactly one *primary* slice.
- All client data is **pseudonyms or initials only**. Personas and fixtures in this pack are fictional.

## 3. Roles

Roles are **cumulative**: Supervisor and Admin are added on top of User. One account may hold several roles.

| Capability | User | Supervisor | Admin |
|---|:-:|:-:|:-:|
| Log, edit, delete own pending or rejected entries | ✅ | | |
| See own approval status and rejection reasons | ✅ | | |
| Request a supervisor (same organization) | ✅ | | |
| View peers' schedules (same accepted supervisor) | ✅ | | |
| Accept or decline supervision requests | | ✅ | |
| View accepted supervisees' progress and entries | | ✅ | |
| Approve or reject entries (single or bulk) | | ✅ | |
| Revert an approval (reason required) | | ✅ | |
| Invite, create, edit, deactivate, delete users | | | ✅ |
| Assign or remove roles | | | ✅ |
| Set a user's organization | | | ✅ |
| Create, rename, delete organizations | | | ✅ |
| View any user's entries or notes | | | ❌ (only through a supervisor link) |

## 4. Functional requirements

### 4.1 Authentication and invites (Slice S1)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-AUTH-01 | Users sign in with Google through Cognito. Sign-up is **invite-only**: Cognito self sign-up is disabled and a PreSignUp trigger rejects any email not on the `invitations` allowlist (covers federated sign-ins). | Must | Decided |
| FR-AUTH-02 | The first admin (`malcolmj0415@gmail.com`) and the "Default Organization" are seeded at deploy by a script. | Must | Decided / Default |
| FR-AUTH-03 | On first sign-in the Cognito identity is bound to the existing `users` row (`cognito_sub`). Data is keyed by internal `user_id`, never by email or `sub`. | Must | Decided |
| FR-AUTH-04 | The API derives roles from Cognito group claims (`admin`, `supervisor`) and re-verifies them against the `users` row on each request. | Must | Decided |
| FR-AUTH-05 | Deactivated users cannot sign in and cannot use an existing token for data access. | Must | Decided |
| FR-AUTH-06 | The SPA shows a signed-out landing page, handles the Cognito hosted-UI redirect, sign-out, and an "access not granted" message when the invite check fails. | Must | Default |

### 4.2 Logging hours (Slice S2)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-LOG-01 | A user creates an entry with: `session_date`, `start_time`, `end_time`, `category`, zero or more clients, `on_site`, and optional `notes`. | Must | Decided |
| FR-LOG-02 | Hours are **calculated** from start and end. The server rejects any client-sent hours field. The UI shows calculated hours read-only. | Must | Decided |
| FR-LOG-03 | End must be after start. No sessions across midnight. Times are in 15-minute steps. Times are local clock time with no timezone conversion. | Must | Default |
| FR-LOG-04 | A user's overlapping sessions are **blocked** with a clear message. The check ignores rejected entries and legacy entries without times. It is enforced in the database. | Must | Decided |
| FR-LOG-05 | A user can edit or delete own entries that are **pending or rejected**. | Must | Decided |
| FR-LOG-06 | Clients are a per-user saved list, unique case-insensitively. Users add one inline with a **+** button and choose several from a checkbox multi-select dropdown. The table shows one client per line. | Must | Decided |
| FR-LOG-07 | The 12 categories are lookup data in a `categories` table, grouped Direct / Indirect / Supervision. The category dropdown groups by these. | Must | Decided |
| FR-LOG-08 | The entries table supports sorting (Date, Category, Client, Hours, On-site) with ▲/▼ and `aria-sort`, filters (group, client text, date range), **Clear filters**, resizable columns, group badges, empty and no-match states, and server-side pagination (default 50). Default sort is newest first. Category sort groups by group, then category name. | Must | Decided |
| FR-LOG-09 | The client field and the notes field show a warning: pseudonyms or initials only; supervisors can read notes. | Must | Decided |
| FR-LOG-10 | Validation failures show clear messages (toast plus inline), never a silent failure. | Must | Decided |

### 4.3 Goals and progress (Slice S3)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-GOAL-01 | Four goals exist per user: Direct Service (default 1200 h), Supervision (100 h, Group + Individual combined), Total Activity (3000 h), Total Time On-site (no target, tracked only). | Must | Decided |
| FR-GOAL-02 | Targets are per-user editable settings, not hard-coded. | Must | Decided |
| FR-GOAL-03 | **Approved** hours drive progress. **Pending** hours show as a lighter segment. **Rejected** hours are excluded. | Must | Decided |
| FR-GOAL-04 | Progress bars are ruler-style with ticks at 25/50/75%, `role="progressbar"`, and readable `aria-valuetext`. | Must | Decided |
| FR-GOAL-05 | The Supervision card shows the Group / Individual split. | Should | Decided |

### 4.4 Milestone celebrations (Slice S9)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-MS-01 | Milestones fire at 25/50/75/100% of each goal except On-site, triggered by **approved** hours. | Must | Decided |
| FR-MS-02 | `last_celebrated_percent` is stored per goal. On next app load, celebrate once for newly crossed milestones, then record it. Never replay on reload, and never replay after a revert followed by re-approval. | Must | Decided |
| FR-MS-03 | A solid-color banner (cycling gold, lime, red) plus confetti, with the specified messages. Confetti respects `prefers-reduced-motion`. | Must | Decided |

### 4.5 Import and export (Slice S4)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-IO-01 | Import the prototype `.md` ledger. Both layouts (with and without `Start` / `End` columns) are accepted. | Must | Decided |
| FR-IO-02 | Imported rows without times are flagged **Needs time**. They keep their hours and count toward goals, and are excluded from schedules until a time is added. | Must | Decided |
| FR-IO-03 | Import merges client names from the `Clients / Groups` section and from entries into the saved list (case-insensitive de-dupe). It parses to typed values first, then uses parameterized inserts. Bad rows are reported, not silently dropped. | Must | Decided |
| FR-IO-04 | Export to Markdown (round-trippable, includes Start and End). | Must | Decided |
| FR-IO-05 | Export to CSV with spreadsheet formula-injection protection on text cells. | Must | Default |
| FR-IO-06 | Export to PDF generated **in the browser**. | Must | Decided |

### 4.6 Organizations and admin console (Slice S5)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-ADM-01 | Admins create, rename, and delete organizations. Deleting is blocked while anyone belongs to the organization. | Must | Decided |
| FR-ADM-02 | Admins invite or create users (name, email, roles, **required** organization), and edit them. | Must | Decided |
| FR-ADM-03 | Admins assign and remove roles, including Supervisor. Only admins can. | Must | Decided |
| FR-ADM-04 | Changing a user's organization ends their supervision link and cancels pending requests, after a confirmation that states the consequences. If a supervisor's organization changes, all their supervisees' links end. | Must | Decided |
| FR-ADM-05 | Deleting is two steps: **deactivate** (blocks sign-in, hides from lists, data kept), then **permanently delete** (removes entries, clients, links). The audit log keeps a snapshot of the display name. | Must | Decided |
| FR-ADM-06 | The last remaining admin cannot be demoted, deactivated, or deleted. | Must | Decided |
| FR-ADM-07 | Every admin action is written to `admin_audit_log`. | Must | Decided |
| FR-ADM-08 | Editing a user's email triggers a re-invite. The old email loses access immediately. First sign-in with the new email re-binds to the existing row. | Must | Decided |
| FR-ADM-09 | Deactivated users disappear from all lists, searches, and schedules. | Must | Decided |
| FR-ADM-10 | Admins cannot read any user's entries or notes except through a supervisor link. | Must | Decided |

### 4.7 Supervision links and notifications (Slice S6)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-SUP-01 | A page lists active supervisors in the user's organization, searchable by first or last name, each with **Request supervision** (disabled while a request is pending or accepted; shows "Request pending" with cancel). | Must | Decided |
| FR-SUP-02 | A user has at most one active link (`pending` or `accepted`). Self-requests are blocked. Users request only supervisors in their own organization. Enforced in the database. | Must | Decided |
| FR-SUP-03 | A supervisor Requests page lists pending requests with **Accept** and **Decline**, and a navigation badge shows the count. Decline needs no reason. | Must | Decided / Default |
| FR-SUP-04 | The supervisee, the supervisor, or an admin may end a link. History and past approvals are kept. | Must | Decided |
| FR-SUP-05 | Accept re-checks organization and link state inside the transaction (race safety). | Must | Decided |
| FR-SUP-06 | With no active supervisor, the supervisee sees a banner "No active supervisor, request one". Entries remain Pending. | Must | Decided |
| FR-NOT-01 | A `notifications` table stores in-app notifications. Events: request received (supervisor); request accepted, declined, ended; entry approved, rejected, reverted (supervisee). | Must | Decided / Default |
| FR-NOT-02 | The client polls an unread-count endpoint about every 60 s and on window focus. A navigation badge shows the count. No WebSockets, no email. | Must | Decided |
| FR-NOT-03 | A notifications inbox page lists notifications and supports mark as read (single and all). | Must | Decided |

### 4.8 Review workflow (Slice S7)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-REV-01 | A supervisor approves or rejects a supervisee's pending entry. **Rejection requires a reason.** | Must | Decided |
| FR-REV-02 | **Bulk approve** by selection or date range runs in one transaction, uses conditional updates (`WHERE status = 'pending'`), and reports skipped entries. | Must | Decided |
| FR-REV-03 | A supervisor can **revert** an approval to Pending (reason required). | Must | Decided |
| FR-REV-04 | Approved entries are locked (no edit or delete) until reverted. Enforced in the service layer with a database backstop. | Must | Decided |
| FR-REV-05 | Saving an edited rejected entry sets it back to Pending. | Must | Decided |
| FR-REV-06 | Every status change writes `entry_status_history` (who, when, from/to, reason). | Must | Decided |
| FR-REV-07 | Users see status chips (Pending / Approved / Rejected with reason) on their entries, and can filter by status. | Must | Decided |
| FR-REV-08 | Entries with no active supervisor stay Pending. Past approvals remain valid after a link ends. | Must | Decided |

### 4.9 Supervisor dashboard (Slice S8)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-DASH-01 | A supervisor selects a supervisee and sees a per-goal progress summary (approved vs pending), counts of pending and rejected entries, and last entry date. Computed server-side with SQL aggregates. | Must | Decided |
| FR-DASH-02 | Drill-down to the supervisee's entries list (filters, sorting, pagination) with approve, reject, bulk approve, and revert actions. | Must | Decided |
| FR-DASH-03 | A supervisee list shows pending counts so a supervisor can prioritize. | Should | Default |

### 4.10 Team schedules (Slice S10)

| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-SCH-01 | Users who share the **same accepted supervisor** can search peers (within the peer group only) and open a read-only **Monday to Friday** week view. Supervisors also see their accepted supervisees. | Must | Decided / Default |
| FR-SCH-02 | Week picker with previous, next, and this week; default is the current week. `weekStart` must be a Monday. | Must | Decided |
| FR-SCH-03 | Peers see **only time block and category**. Never client names, notes, hours, on-site flag, or approval status. A dedicated whitelisted DTO is used. | Must | Decided |
| FR-SCH-04 | Rejected entries and Needs-time entries are hidden. Weekend entries are not shown; the page says "N entries on weekend not shown". | Must | Default |
| FR-SCH-05 | URL-driven state (`?user=…&week=YYYY-MM-DD`). The grid collapses to a day list on narrow screens and is keyboard accessible. | Must | Decided |

## 5. Non-functional requirements

| ID | Requirement | Pri | Slice |
|---|---|---|---|
| NFR-SEC-01 | **Every query uses bound parameters.** Static `.sql` through sqlc; sort columns from an allowlist (else 400); LIKE wildcards escaped and term length capped; DB role least privilege (no DDL). CI gates: gosec G201/G202, a rule forbidding string-built SQL, sqlc output current. | Must | S0 (gates), S11 (suite) |
| NFR-SEC-02 | One central policy package `internal/authz` used by every handler. IDOR guarded on every `{id}` path parameter. | Must | S1 (framework), each slice |
| NFR-SEC-03 | Responses use dedicated DTOs with explicit field lists. Tests assert client names and notes cannot leak in peer responses. | Must | S10 |
| NFR-SEC-04 | IAM least privilege per function. TLS everywhere. Encryption at rest. S3 private with OAC. No open CIDRs. DB in private subnets. Secrets in Secrets Manager. | Must | S0 |
| NFR-SEC-05 | Dependency hygiene: `govulncheck`, `npm audit`, Dependabot. Body size limits and field length validation. Security headers and CSP on the SPA. | Must | S0, S11 |
| NFR-SEC-06 | Required negative tests: cross-organization requests, cross-organization supervisor lookup, non-peer schedule, supervisor acting on non-supervisee, non-admin on admin routes, admin reading entries without a link. | Must | S11 |
| NFR-OPS-01 | `/healthz`, structured JSON logs (`slog`) with request IDs, CloudWatch alarms on errors and 5xx, API Gateway throttling (tighter on search). | Must | S0, S11 |
| NFR-OPS-02 | Pipeline: GitHub → CodePipeline → build/test → deploy dev → migrate → smoke → **manual approval** → deploy prod → migrate. Migrations are forward-only and expand/contract. | Must | S0 |
| NFR-OPS-03 | Alerts (budget, pipeline failure) go to the owner email; SNS subscription confirmed once. | Must | S0 |
| NFR-OPS-04 | Tags `app`, `env`, `owner` on all resources. Log retention 14 d (dev) / 30 d (prod). | Must | S0 |
| NFR-COST-01 | Total cost under **$50/month** for both environments. No NAT Gateway, RDS Proxy, VPC interface endpoints, load balancers, Multi-AZ, extra databases, or paid third-party services without explicit approval. | Must | all |
| NFR-REL-01 | Prod RDS has deletion protection and 7-day backups; dev has 1-day backups. Lambda API reserved concurrency protects the DB connection limit. | Must | S0 |
| NFR-PERF-01 | p95 API latency under 500 ms for list and aggregate endpoints at 50 users and 20,000 entries (warm). Cold start under 2 s. | Should | S11 |
| NFR-A11Y-01 | WCAG 2.1 AA: contrast ≥ 4.5:1, labelled inputs, real `<button>` sort controls, `role="progressbar"`, `prefers-reduced-motion`, keyboard operable. axe checks on key pages. | Must | each slice |
| NFR-UX-01 | Preserve the prototype UX and theme tokens (CLAUDE.md §12). Fonts self-hosted (Fredoka, Inter). | Must | S2 |
| NFR-DOC-01 | OpenAPI is the contract and changes **before** endpoint or client code. Docs and runbook are current at go-live. | Must | each slice |

## 6. Business rules

| ID | Rule |
|---|---|
| BR-01 | Every user belongs to exactly one organization. |
| BR-02 | One supervisor per user; at most one `pending` or `accepted` link per supervisee. |
| BR-03 | Supervisors receive requests only from their own organization. |
| BR-04 | Approved entries are immutable until reverted. |
| BR-05 | Progress counts approved hours only; pending are shown lighter; rejected are excluded. |
| BR-06 | A milestone is celebrated at most once per goal and percentage. |
| BR-07 | Admin scope is global across organizations, but admins have no entry access. |
| BR-08 | A user's email change never changes their `user_id` or data ownership. |
| BR-09 | Hours = (end − start) in minutes ÷ 60, stored as `duration_minutes`. |

## 7. Assumptions and open questions

| ID | Item | Default taken | Owner decision |
|---|---|---|---|
| ASM-01 | Peers do not see rejected entries; supervisors also get Team Schedules for supervisees. | Yes | **Confirmed 2026-10-10** |
| ASM-02 | No midnight crossing; 15-minute increments; weekend entries allowed but hidden with count hint. | Yes | **Confirmed 2026-10-10** |
| ASM-03 | First organization seeded as "Default Organization". | Yes | **Confirmed 2026-10-10** |
| ASM-04 | Supervisees are notified of request outcomes and entry reviews; decline needs no reason. | Yes | **Confirmed 2026-10-10** |
| ASM-05 | Changing organization ends links and cancels requests automatically. | Yes | **Confirmed 2026-10-10** |
| ASM-06 | Hours are shown to two decimals (e.g. 1.25) because 15-minute steps produce quarter hours. | Yes | **Confirmed 2026-10-10** |
| ASM-07 | Re-importing a ledger skips exact duplicates (same date, category, hours, notes and client set) and reports them. | Yes | **Confirmed 2026-10-10** |
| OQ-01 | Cognito Google-only, or also allow email/password? Account linking between native and federated users is complex. | Google-only (simplest) | **Decided 2026-10-10: Google sign-in only.** S1-02 spike no longer needs to evaluate email/password. |
| OQ-02 | Should a supervisor with pending-only supervisees see zero-progress cards? | Show with zeros | **Decided 2026-10-10** |
| OQ-03 | Data retention after permanent delete (backups hold data up to 7 days in prod). | Accept | **Decided 2026-10-10: accept 7-day backup window** |

## 8. Constraints and dependencies

- AWS region **us-west-2**; one account with `dev` and `prod`.
- GitHub owner `malcolmjefferson`; three public repos (made public 2026-10-10) (`therapy_service_hours_frontend`, `_backend`, `_infra`). **The owner creates these** and connects CodeConnections (a console click).
- A Google OAuth client must be created by the owner; its secret is stored in Secrets Manager (ticket S1-01).
- Recommended designs that need an **Accepted** ADR before building: ADR-0001 to ADR-0006.

## 9. Acceptance of this document

Accepted when the owner confirms the Section 7 defaults (or changes them) and approves ADR-0001 to ADR-0006. See `05-execution-plan.md` for the gate schedule.
