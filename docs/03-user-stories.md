# 03. User Stories

Format: **As a** persona **I want** … **so that** …. Acceptance criteria (AC) are Given / When / Then. Each story maps to requirements (FR / NFR) and one primary **slice** (S0 to S11, see `05-execution-plan.md`). Ticket coverage is in `08-traceability-matrix.md`.

## Index

| ID | Persona | Title | Slice | Requirements |
|---|---|---|---|---|
| US-01 | Maya | Sign in with Google | S1 | FR-AUTH-01, 03, 06 |
| US-02 | Maya | Be told clearly when not invited | S1 | FR-AUTH-01, 06 |
| US-03 | Maya | Log a session | S2 | FR-LOG-01, 02, 03, 07, 10 |
| US-04 | Maya | Be blocked from overlapping sessions | S2 | FR-LOG-04 |
| US-05 | Maya | Save and reuse clients | S2 | FR-LOG-06 |
| US-06 | Maya | Be warned to use pseudonyms | S2 | FR-LOG-09 |
| US-07 | Maya | Sort, filter and page my entries | S2 | FR-LOG-08 |
| US-08 | Maya | Edit or delete my pending entries | S2 | FR-LOG-05 |
| US-09 | Maya | See progress toward my goals | S3 | FR-GOAL-01, 03, 04, 05 |
| US-10 | Maya | Change my goal targets | S3 | FR-GOAL-02 |
| US-11 | Maya | Import my old ledger | S4 | FR-IO-01, 02, 03 |
| US-12 | Maya | Export my hours | S4 | FR-IO-04, 05, 06 |
| US-13 | Maya | Celebrate milestones | S9 | FR-MS-01, 02, 03 |
| US-14 | Maya | Find and request a supervisor | S6 | FR-SUP-01, 02 |
| US-15 | Maya | See approval status and fix rejected entries | S7 | FR-REV-05, 07, FR-REV-04 |
| US-16 | Maya | Know when I have no supervisor | S6 | FR-SUP-06, FR-REV-08 |
| US-17 | Maya | Add times to imported entries | S4 | FR-IO-02 |
| US-18 | Priya | Accept or decline requests | S6 | FR-SUP-03, 05 |
| US-19 | Priya | See my supervisees' progress | S8 | FR-DASH-01, 03 |
| US-20 | Priya | Review a supervisee's entries | S8 | FR-DASH-02 |
| US-21 | Priya | Approve or reject with a reason | S7 | FR-REV-01 |
| US-22 | Priya | Bulk approve | S7 | FR-REV-02 |
| US-23 | Priya | Revert an approval | S7 | FR-REV-03 |
| US-24 | Priya | See the status history | S7 | FR-REV-06 |
| US-25 | Priya | Be notified of new requests | S6 | FR-NOT-01, 02 |
| US-26 | Maya | See my notifications | S6 | FR-NOT-01, 02, 03 |
| US-27 | Maya | Cancel a request or end supervision | S6 | FR-SUP-04 |
| US-28 | Sam | Manage organizations | S5 | FR-ADM-01 |
| US-29 | Sam | Invite or create users | S5 | FR-ADM-02 |
| US-30 | Sam | Assign roles | S5 | FR-ADM-03 |
| US-31 | Sam | Move a user to another organization safely | S5 | FR-ADM-04 |
| US-32 | Sam | Deactivate, then permanently delete | S5 | FR-ADM-05, 09 |
| US-33 | Sam | Be prevented from removing the last admin | S5 | FR-ADM-06 |
| US-34 | Sam | Review the admin audit log | S5 | FR-ADM-07 |
| US-35 | Sam | Change a user's email | S5 | FR-ADM-08, 10 |
| US-36 | Jordan | Search my peers | S10 | FR-SCH-01 |
| US-37 | Jordan | View a peer's week | S10 | FR-SCH-02, 04, 05 |
| US-38 | Jordan | Trust that peers see only time and category | S10 | FR-SCH-03, NFR-SEC-03 |
| US-39 | Riley | Ship to dev and prod through one pipeline | S0 | NFR-OPS-02, NFR-SEC-04, NFR-REL-01 |
| US-40 | Riley | Run database migrations safely | S0 | NFR-OPS-02 |
| US-41 | Riley | Get alerts and stay under budget | S0 | NFR-OPS-03, NFR-COST-01 |
| US-42 | Riley | Observe the running system | S0 | NFR-OPS-01, 04 |
| US-43 | Riley | Prove queries cannot be injected | S11 | NFR-SEC-01, 05 |
| US-44 | Riley | Prove authorization holds | S11 | NFR-SEC-02, 06 |
| US-45 | Riley | Go live with confidence | S11 | NFR-PERF-01, NFR-A11Y-01, NFR-DOC-01 |
| US-46 | Riley | Seed the first admin | S1 | FR-AUTH-02 |

---

## S1: Secure sign-in

### US-01 Sign in with Google
**As** Maya **I want** to sign in with my Google account **so that** I need no new password.
- **Given** my email is on the invitation list **When** I click Sign in and complete Google **Then** I land on the app and my name appears in the header.
- **Given** it is my first sign-in **When** it completes **Then** my identity is bound to the existing user row without creating a duplicate.
- **Given** I click Sign out **Then** my session ends and the landing page shows.

### US-02 Be told clearly when not invited
**As** Maya **I want** a clear message if I am not invited **so that** I know to contact the admin.
- **Given** my email is not invited **When** I try Google sign-in **Then** I see "Access has not been granted. Ask your administrator for an invitation." and no account is created.
- **Given** I am deactivated **When** I try to sign in or use an old token **Then** access is refused.

### US-46 Seed the first admin
**As** Riley **I want** the first admin and Default Organization created at deploy **so that** someone can invite everyone else.
- **Given** a fresh environment **When** the seed script runs **Then** the invitation, user row (Admin) and "Default Organization" exist.
- **Given** the script is run twice **Then** nothing is duplicated or changed.

## S2: Log hours

### US-03 Log a session
**As** Maya **I want** to enter date, category, start and end time, clients, on-site and notes **so that** my hours are recorded.
- **Given** valid inputs **When** I click Add entry **Then** the entry appears at the top of my table as Pending, with calculated hours (e.g. 1.5).
- **Given** end ≤ start, a time outside 15-minute steps, or a missing required field **Then** I see an inline message and a toast and nothing is saved.
- **Given** a request that includes an `hours` field **Then** the API returns 400.

### US-04 Be blocked from overlapping sessions
- **Given** a non-rejected entry 09:00 to 10:00 **When** I add 09:30 to 10:30 **Then** I see "This overlaps an existing session on 2026-01-05 (09:00 to 10:00)" and nothing is saved.
- **Given** the overlapping entry is rejected, or a legacy entry without times **Then** no conflict is raised.
- **Given** two concurrent requests **Then** the database exclusion constraint permits only one.

### US-05 Save and reuse clients
- **Given** I click **+** next to the client dropdown **When** I enter "A.B." **Then** it is saved and selected; entering "a.b." again does not duplicate.
- **Given** I select several clients **Then** the table shows each on its own line.

### US-06 Be warned to use pseudonyms
- **Given** the client and notes fields **Then** a visible warning reads "Use pseudonyms or initials only. Supervisors can read notes."

### US-07 Sort, filter and page my entries
- **Given** my entries **When** I click a sort header **Then** order toggles ▲/▼ with `aria-sort` updated.
- **When** I filter by group, client text, or date range **Then** only matches show, with a no-match state; **Clear filters** resets.
- **Given** more than 50 entries **Then** I can page.
- **Given** a sort value outside the allowlist **Then** the API returns 400.

### US-08 Edit or delete my pending entries
- **Given** a Pending or Rejected entry **When** I edit and save **Then** changes persist and the same overlap and time rules apply.
- **When** I delete **Then** I confirm first and the entry is removed.

## S3: Goals and progress

### US-09 See progress toward my goals
- **Given** approved and pending entries **Then** each goal card shows approved hours as the main fill and pending as a lighter segment, with ticks at 25/50/75%.
- **Then** each bar has `role="progressbar"` and an `aria-valuetext` such as "312 of 1200 hours approved, 20 pending".
- **Given** rejected entries **Then** they are excluded.
- **Then** Supervision shows Group and Individual split; On-site shows hours with no target.

### US-10 Change my goal targets
- **When** I set Direct Service to 1500 **Then** the bar recalculates immediately and persists.
- **Given** a value ≤ 0 or non-numeric **Then** it is rejected with a message.

## S4: Import and export

### US-11 Import my old ledger
- **Given** a prototype `.md` file **When** I import it **Then** I see a summary: entries imported, clients merged, rows skipped with reasons.
- **Then** imported rows are flagged **Needs time** and count toward goals as Pending.
- **Given** a row with an escaped pipe, multiple clients separated by `; `, or `—` as client **Then** each parses correctly.
- **Given** a crafted row such as `'; DROP TABLE entries;--` **Then** it imports as plain text with no effect.
- **Given** the file is over the size limit or not Markdown **Then** a clear error shows.

### US-12 Export my hours
- **When** I choose Markdown, CSV, or PDF **Then** a file downloads containing my entries with Start and End.
- **Then** re-importing the Markdown export yields identical data (round trip).
- **Given** a note beginning `=` or `+` **Then** the CSV cell is neutralized.
- **Then** the PDF is produced in the browser with no server call.

### US-17 Add times to imported entries
- **Given** a Needs-time entry **When** I edit it and add valid times **Then** the flag clears and hours recalculate from the times.

## S5: Admin console

### US-28 Manage organizations
- Create and rename organizations (names unique). Delete is blocked with a message while any user belongs to it.

### US-29 Invite or create users
- **When** I enter name, email, roles and organization (required) **Then** an invitation and user row are created and the person can sign in with Google.

### US-30 Assign roles
- **When** I toggle Supervisor or Admin **Then** it takes effect on next token refresh at the latest, and is written to the audit log.
- **Given** I am not an admin **Then** the API returns 403.

### US-31 Move a user to another organization safely
- **When** I change a user's organization **Then** a dialog lists the consequences (active link ended, pending requests cancelled; for a supervisor, all supervisees' links end). Nothing changes until I confirm.

### US-32 Deactivate, then permanently delete
- **Deactivate** blocks sign-in and hides the user from lists; data is kept.
- **Permanently delete** is available only for deactivated users, requires typing the user's name, removes entries, clients and links, and the audit log keeps the display-name snapshot.

### US-33 Be prevented from removing the last admin
- **Given** one admin remains **When** I try to demote, deactivate or delete them **Then** the action is refused with an explanation.

### US-34 Review the admin audit log
- **Then** a paginated list shows actor, action, target, time and details, newest first.

### US-35 Change a user's email
- **When** I edit the email **Then** the old email cannot sign in immediately, a new invitation is created, and first sign-in with the new email re-binds to the same `user_id` with all data intact.
- **Then** I cannot browse any user's entries or notes from the admin console.

## S6: Supervision and notifications

### US-14 Find and request a supervisor
- **Then** the page lists active supervisors in my organization only, searchable by first or last name.
- **When** I click Request supervision **Then** the button shows "Request pending" with Cancel, and other buttons are disabled.
- **Given** a supervisor in another organization **Then** they never appear and a direct API call returns 403 or 404.

### US-16 Know when I have no supervisor
- **Given** no accepted supervisor **Then** a banner "No active supervisor. Request one." shows with a link, and entries stay Pending.

### US-18 Accept or decline requests
- **Then** the Requests page lists pending requests; Accept makes the link active; Decline needs no reason.
- **Given** the supervisee moved organization or cancelled meanwhile **When** I accept **Then** I see "This request is no longer valid".

### US-25 Be notified of new requests
- **When** a request is created **Then** the supervisor's nav badge shows the count within 60 s or on window focus.

### US-26 See my notifications
- **Then** the inbox lists notifications newest first; I can mark one or all as read; the badge updates.

### US-27 Cancel a request or end supervision
- Supervisee cancels a pending request; supervisee, supervisor or admin ends an accepted link. Past approvals are kept, and the supervisee can request someone new.

## S7: Review workflow

### US-15 See approval status and fix rejected entries
- **Then** each entry shows a Pending / Approved / Rejected chip; rejected shows the reason.
- **Given** Approved **Then** Edit and Delete are disabled with an explanation.
- **When** I edit and save a Rejected entry **Then** it returns to Pending and the supervisor is notified.

### US-21 Approve or reject with a reason
- **Approve** sets Approved and locks the entry. **Reject** requires a non-empty reason.
- **Given** the entry is no longer Pending **Then** I see a conflict message and nothing changes.
- **Given** the entry belongs to a non-supervisee **Then** 403 or 404.

### US-22 Bulk approve
- **When** I select entries or a date range **Then** all Pending in scope are approved in one transaction and a report lists any skipped (not pending, not mine) with reasons.

### US-23 Revert an approval
- **When** I revert with a reason **Then** the entry returns to Pending and unlocks; progress drops accordingly; the supervisee is notified.

### US-24 See the status history
- **Then** an entry's history lists each change: who, when, from/to, reason. The name is a snapshot, so it survives user deletion.

## S8: Supervisor dashboard

### US-19 See my supervisees' progress
- **Then** I see my accepted supervisees; selecting one shows per-goal approved vs pending hours, counts of pending and rejected entries, and last entry date.

### US-20 Review a supervisee's entries
- **Then** I see a filterable, sortable, paginated entries list with approve, reject, bulk approve and revert actions.

## S9: Milestones

### US-13 Celebrate milestones
- **Given** approved hours cross 25% of a goal **When** I next load the app **Then** a solid-color banner and confetti show once with the right message, and `last_celebrated_percent` is updated.
- **Then** reloading never replays it. Reverting then re-approving never replays it.
- **Given** `prefers-reduced-motion` **Then** no confetti shows; the banner does.
- **Given** one approval crosses several milestones **Then** the highest is celebrated once.

## S10: Team schedules

### US-36 Search my peers
- **Then** search lists only users sharing my accepted supervisor (and, for supervisors, their supervisees). No global directory. Deactivated users never appear.

### US-37 View a peer's week
- **Then** a Monday to Friday grid shows blocks by time with category; previous / next / this week navigation; state in the URL.
- **Given** weekend entries **Then** "N entries on weekend not shown" appears.
- **Given** a narrow screen **Then** the grid becomes a day list. Keyboard navigation works.
- **Given** `weekStart` is not a Monday **Then** 400.

### US-38 Trust that peers see only time and category
- **Then** the response contains only date, start, end, category. Tests assert client names, notes, hours, on-site and status never appear. Rejected and Needs-time entries are absent.
- **Given** a user outside my peer group **Then** 403 or 404.

## S0 and S11: Platform and go-live

### US-39 Ship to dev and prod through one pipeline
- **When** a change merges to `main` in any repo **Then** the pipeline lints, tests, builds, deploys to dev, migrates, smoke-tests, and waits for my manual approval before prod.

### US-40 Run database migrations safely
- **Then** migrations run through a Lambda inside the VPC, are forward-only, safe before the new code goes live, and a failure stops the release before prod.

### US-41 Get alerts and stay under budget
- **Then** budget and pipeline-failure alerts reach my email; no disallowed service is deployed (a synth-time check fails the build if one appears).

### US-42 Observe the running system
- **Then** `/healthz` responds, logs are structured JSON with request IDs, alarms exist for Lambda errors and API 5xx.

### US-43 Prove queries cannot be injected
- **Then** CI fails on string-built SQL; injection payloads against every text, search and sort input and crafted import rows leave data and behavior unchanged.

### US-44 Prove authorization holds
- **Then** the required negative tests (NFR-SEC-06) pass in CI against a real PostgreSQL container.

### US-45 Go live with confidence
- **Then** performance, accessibility, E2E and security gates pass on dev; the runbook, user guide and CLAUDE.md are updated; prod approval is given.
