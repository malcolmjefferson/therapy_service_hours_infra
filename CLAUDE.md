# CLAUDE.md: Therapy Service Hours Tracker

> Project specification and working agreements for Claude Code.
> Source: planning interview, 2026-10-09. Decisions recorded 2026-10-10 (ADR-0001 to ADR-0006 accepted; assumptions confirmed). Status: **planning complete, implementation not started.**
> This file is shared context for all three repositories. Copy it into the root of each repo, or keep one copy in `therapy_service_hours_infra` and reference it from the others.

---

## 0. Working agreements (read first)

1. **Never assume.** If a requirement is ambiguous, list your assumptions or ask before building. Do not invent business rules or tech choices not recorded here.
2. **Production-first.** No "quick hacks" or placeholder logic unless explicitly asked for a proof of concept. Everything is "Day 2 ready": error handling, validation, logging, security, and tests.
3. **Atomic work.** Break work into the smallest units. If a task would take a developer more than 2 days, split it.
4. **Definition of Done** for every change:
   - **Implementation:** the code or design.
   - **Validation:** automated tests, plus manual steps if relevant.
   - **Documentation:** how a reviewer verifies it; update this file or the OpenAPI spec when contracts change.
5. **Interface first.** Change `api/openapi.yaml` (backend repo) *before* implementing an endpoint or its client.
6. **Budget guard.** The target is under **$50/month for both environments combined**. Do not add any of the following without explicit approval: NAT Gateway, RDS Proxy, VPC interface endpoints, load balancers (ALB/NLB), Multi-AZ databases, additional databases, paid third-party services. See section 4.
7. **Data guard.** Client data is **pseudonyms or initials only**. Never put real names in code, fixtures, tests, logs, or docs. Never commit secrets.
8. **Scannable communication.** Use Markdown headers, bold key terms, and bullets in PRs and docs.
9. **Engineering standards.** Follow `docs/standards/` (planning pack, copied into each repo root by ticket S0-01):
   - `01-go-coding-standards.md` (`GO-NN`) and `02-react-coding-standards.md` (`FE-NN`), both including **SOLID** rules
   - `03-architecture-standards.md` (`ARC-NN`) and `04-security-standards.md` (`SEC-NN`)
   - **MUST** rules block a merge; **SHOULD** rules need a one-line reason in the PR to skip. The checklist at the end of each relevant document is part of the Definition of Done. Departing from a **MUST** needs an ADR.
10. **Status tracking.** Each repo keeps `STATUS.md` current: a short summary at the top and one row per ticket touching the repo (ID, title, status, PR links, notes). Update it in the **same PR** that changes a ticket's state; rows describe the state once that PR merges (**not started**, **in progress**, **in review**, **done**).

### Decision status legend

| Marker | Meaning |
|---|---|
| **Decided** | Explicitly chosen by the project owner |
| **Default** | Applied as a sensible default during planning; owner may change it |
| **Recommended** | Proposed by the architect; **confirm in an ADR before building** |
| **Accepted (ADR-NNNN)** | Was Recommended; the owner accepted the ADR, so it is now binding |

---

## 1. Product overview

A hosted web app for therapy trainees to log service hours against licensure goals, with supervisor review and approval. It replaces a working single-file HTML prototype (see section 12) with a full-stack application.

**Core capabilities (v1)**
- Log entries with date, start/end time, category, clients, on-site flag, and notes
- Track progress toward goals, with milestone celebrations at 25/50/75/100%
- Supervisor roles: supervisees request a supervisor; supervisors accept, review, approve, reject, and revert approvals
- Read-only peer schedules for users who share a supervisor
- Organizations: every user belongs to exactly one
- Admin tooling for users, roles, and organizations
- Invite-only sign-up with Google sign-in
- Import of the prototype's Markdown ledger; export to Markdown, CSV, and PDF
- In-app notifications

**Out of scope for v1:** email notifications, custom domain, multiple supervisors per user, multi-organization membership, HIPAA-grade controls (real client identifiers are not stored), multi-region, mobile apps.

---

## 2. Technology decisions

| Area | Choice | Status |
|---|---|---|
| Frontend | React + TypeScript SPA built with **Vite**; TanStack Query for server state; React Router; hosted on **S3 + CloudFront** | Decided |
| Backend | **Go** with **chi** router, **pgx** driver, **sqlc** for type-safe SQL, **goose** migrations | Decided |
| Compute | **AWS Lambda** (Go, `provided.al2023`) behind **API Gateway HTTP API** | Decided |
| Database | **RDS PostgreSQL**, one `db.t4g.micro` instance per environment, single-AZ | Decided |
| Auth | **Amazon Cognito** with **Google sign-in only** (no email/password; OQ-01 decided 2026-10-10); **invite-only** | Decided |
| IaC | **AWS CDK (TypeScript)** | Decided |
| CI/CD | GitHub to **AWS CodePipeline + CodeBuild** via CodeConnections | Decided |
| Source control | GitHub, three public repos (section 3) | Decided |
| Region | **us-west-2** (Oregon), both environments | Decided |
| Accounts | One AWS account, two environments: **dev** and **prod** | Decided |
| Public URL | Default CloudFront URLs for now; custom domain deferred | Decided |
| PDF export | Generated **in the browser** | Decided |
| DB credentials | **RDS IAM authentication** (token signed locally; no Secrets Manager call needed from the VPC). DB roles `app_rw` (DML only) and `migrator` (DDL) | Accepted (ADR-0001) |
| Admin identity actions | Thin **admin-orchestrator Lambda** (outside VPC; checks the `admin` group, starts the workflow), **identity Lambda** (outside VPC, calls Cognito admin APIs) and the **data step** in the VPC `api` Lambda, coordinated by **Step Functions Express** with compensation | Accepted (ADR-0002) |
| DB migrations in pipeline | Dedicated **migration Lambda** inside the VPC (goose, embedded migrations, advisory lock), **invoked by a non-VPC CodeBuild step** before each app deploy; prod snapshot first | Accepted (ADR-0003) |
| API routing | CloudFront behavior `/api/*` routed to API Gateway so the SPA and API share one origin (no CORS). SPA routing via a **CloudFront Function** rewrite on the S3 behavior only (no distribution-wide error responses) | Accepted (ADR-0004) |
| Pipeline layout | **One CDK Pipelines pipeline owned by the infra repo** with all three repos as sources, queued execution mode, same artifacts promoted dev to prod | Accepted (ADR-0005) |
| API credential | **ID token** as the bearer credential (access tokens carry no `email`, so first-sign-in binding needs the ID token); claims read **only** from the API Gateway authorizer context | Proposed (ADR-0008) |
| Route protection | Cognito JWT authorizer on `ANY /api/v1/{proxy+}`, with `GET /api/v1/healthz` on its own **unauthenticated** route (authorizers are per route) | Proposed (ADR-0008) |
| Pre-sign-up allowlist | VPC trigger reading `invitations` as a read-only role, with **provisioned concurrency** so it answers inside Cognito's fixed 5-second trigger timeout (about $1–3/month, approved 2026-10-11) | Accepted (ADR-0007) |
| Cognito pool placement | User pool, groups, IdP and app clients in the **data stack** (stateful, retained in prod); callback and logout URLs from `EnvConfig`, never a CloudFront stack reference | Proposed (ADR-0009) |
| Invitation lifecycle | `invitations` gains `expires_at` (14-day default) and `status`; first sign-in provisions the `users` row from a pending invitation and stamps acceptance | Proposed (ADR-0010) |
| Sign-in tests | A **dev-only** password app client plus synthetic test users for Playwright and the authenticated smoke check; the Google path is demonstrated manually | Proposed (ADR-0011) |
| API contract tooling | `api/openapi.yaml` is the source of truth; backend **oapi-codegen** (strict chi server); frontend **openapi-typescript** + **openapi-fetch** with a pinned spec copy and a CI drift gate; `spectral` lint and `oasdiff` breaking-change check | Accepted (ADR-0006) |

---

## 3. Repositories

GitHub owner: **`malcolmjefferson`**, all **public** (**Decided** 2026-10-10, so branch protection works on the free plan). Nothing secret or account-specific is committed: the AWS account ID comes from `EXPECTED_AWS_ACCOUNT` (see the infra README).

| Repo | Contents |
|---|---|
| `therapy_service_hours_frontend` | React app, generated API client, tests |
| `therapy_service_hours_backend` | Go API, migrations, SQL queries, **OpenAPI spec (source of truth)** |
| `therapy_service_hours_infra` | CDK stacks, pipeline, environment config, seed scripts |

AWS resource names use the hyphenated prefix **`therapy-service-hours-`** (S3 bucket names cannot contain underscores).

### 3.1 Proposed layouts

**Backend**
```
cmd/api/          Lambda entry: main API (in VPC)
cmd/migrate/      Lambda entry: goose migrations (in VPC)
cmd/identity/     Lambda entry: Cognito admin calls (outside VPC)
cmd/admin-orchestrator/  Lambda entry: admin group check, starts Step Functions (outside VPC; ADR-0002)
cmd/presignup/    Lambda entry: Cognito pre-sign-up invitation allowlist check
internal/domain/  Entities, value objects, domain errors (imports nothing internal)
internal/authz/   Central authorization policy (single source of truth)
internal/config/  Environment configuration
internal/db/      sqlc-generated code + connection/IAM auth
internal/http/    Router, middleware, error mapping
internal/service/ Business logic (entries, goals, supervision, schedules, admin)
db/migrations/    goose *.sql (static, reviewed)
db/queries/       sqlc *.sql
api/openapi.yaml  API contract
sqlc.yaml
```

**Frontend**
```
src/app/          Shell, routing, providers
src/features/     entries, goals, clients, schedules, supervision, admin, notifications
src/components/   Shared UI
src/lib/api/      Client generated from OpenAPI
src/theme/        Design tokens (section 12.2)
```

**Infra**
```
bin/              CDK app entry
lib/pipeline/     Pipeline stack
lib/app/          Network, database, auth, api, web constructs
config/           dev.ts, prod.ts
scripts/          First-admin seed, helpers
```

The frontend generates types from a **pinned copy** of the backend's `api/openapi.yaml` at `src/lib/api/openapi.yaml`, recording the backend commit it came from. The pipeline fails if the pinned copy differs from the backend spec being released; `npm run api:sync` updates it. **Accepted (ADR-0006).**

---

## 4. AWS architecture

```
Users ─► CloudFront ─► S3 (React SPA, private bucket via OAC)
        └─ /api/* ─► API Gateway HTTP API (Cognito JWT authorizer; /healthz public)
                       ├─► Lambda "api" (Go, private subnets) ─► RDS PostgreSQL
                       └─► Lambda "admin-orchestrator" (no VPC) ─► Step Functions Express (admin actions)
                              ├─► Lambda "identity" (no VPC) ─► Cognito admin APIs
                              └─► Lambda "api"/data step (VPC) ─► RDS
Cognito user pool (Google IdP, invite-only, groups: admin, supervisor) — in the data stack (ADR-0009)

GitHub (3 repos) ─► CodePipeline (infra repo) ─► CodeBuild (lint, test, build)
   ─► Deploy DEV: data stack ─► Migrate DEV ─► app stack ─► frontend sync ─► Smoke test
   ─► MANUAL APPROVAL ─► Deploy PROD: snapshot ─► data stack ─► Migrate PROD ─► app stack ─► frontend sync
```

### 4.1 Budget constraints and their consequences

| Constraint | Consequence |
|---|---|
| **No NAT Gateway** (about $33/mo each) | Lambdas run in private subnets with **no internet**. API Gateway validates Cognito JWTs, so the API Lambda does not need the internet. |
| No Secrets Manager call from the VPC | Use **RDS IAM auth** (signed locally). |
| No RDS Proxy (about $15/mo) | Small pgx connection pool; **reserved concurrency cap** on the API Lambda to protect the DB connection limit. |
| Cognito admin APIs unreachable from the VPC | admin-orchestrator and identity Lambdas outside the VPC; Step Functions coordinates them with the VPC data step (ADR-0002). |
| CodeBuild cannot reach a private DB | A non-VPC CodeBuild step invokes the migration Lambda synchronously (ADR-0003). |
| Cognito's synchronous trigger timeout is a fixed **5 s**, and a cold VPC Lambda's first IAM-authenticated connection is known to take longer (`internal/db/pool.go` sets 12 s) | The pre-sign-up trigger gets **provisioned concurrency** (about $1–3/month), the one place where a cold start is a user-visible failure (ADR-0007). |

**Estimated cost:** about **$35–45/month** (two RDS instances about $28; the rest mostly within free tiers). Verify with the AWS Pricing Calculator. Optional saving: scheduled stop of the dev database.

### 4.2 Environments

| Setting | Dev | Prod |
|---|---|---|
| Promotion | Auto on merge to `main` | **Manual approval** after dev succeeds |
| RDS deletion protection | Off | **On** |
| RDS backup retention | 1 day | **7 days** |
| Log retention (proposed) | 14 days | 30 days |
| Public URL | Default CloudFront URL | Default CloudFront URL |

Both are publicly reachable; access is controlled by Cognito, so there is no anonymous use. Use AWS-managed KMS keys (customer-managed keys cost extra). Tag all resources with `app`, `env`, and `owner`.

### 4.3 Setup facts

| Item | Value |
|---|---|
| First admin (seeded at deploy) | `malcolmj0415@gmail.com` (Google sign-in) |
| Alert email (budget alarm, pipeline failures) | `malcolmj0415@gmail.com`; the SNS subscription needs a one-time confirmation click |
| Initial organization | **"Default Organization"** (**Decided**, ASM-03; admin can rename). Required because every user must have an organization. |

---

## 5. Roles and permissions

Roles are **cumulative**: Supervisor and Admin are added on top of the base User capability. One account can hold several (for example User + Admin).

| Capability | User | Supervisor | Admin |
|---|:-:|:-:|:-:|
| Log, edit, delete own **pending or rejected** entries | ✅ | | |
| See own approval status, rejection reasons | ✅ | | |
| Request a supervisor (same organization) | ✅ | | |
| View peers' schedules (same supervisor) | ✅ | | |
| Accept / decline supervision requests | | ✅ | |
| View accepted supervisees' progress and entries | | ✅ | |
| Approve / reject entries (single or bulk) | | ✅ | |
| Revert an approval (with reason) | | ✅ | |
| Invite, create, edit, deactivate, delete users | | | ✅ |
| Assign or remove roles (incl. Supervisor) | | | ✅ |
| Set a user's organization | | | ✅ |
| Create, rename, delete organizations | | | ✅ |
| View any user's entries or notes | | | ❌ (only via a supervisor link) |

**Only admins** can create/edit/delete users, assign roles, or set organizations. **Admin scope is global** across organizations.

### 5.1 Admin guardrails

- Refuse to demote, deactivate, or delete the **last remaining admin**.
- Every admin action is written to `admin_audit_log`.
- **Delete is two steps:** *deactivate* (blocks sign-in, hides from lists, data kept), then an explicit *permanently delete* (removes entries, clients, links). The audit trail keeps a snapshot of the deleted person's display name.
- **Editing a user's email triggers a re-invite.** Data is keyed to an internal `user_id`, never email or Cognito `sub`. The old email loses access immediately; first sign-in with the new email re-binds to the existing user row.
- Deactivated users disappear from all lists, searches, and schedules.

---

## 6. Organizations and supervision

### 6.1 Organizations
- Every user belongs to **exactly one organization**, required at invite time.
- Only admins set it. **Changing a user's organization ends their supervision link and cancels pending requests**, after a UI confirmation that states the consequences. If a supervisor's organization changes, all of their supervisees' links end.
- An organization cannot be deleted while anyone belongs to it.

### 6.2 Supervision links
- **One supervisor per user.** At most one active link (`pending` or `accepted`) per supervisee. A user cannot have two requests pending; cancel first.
- Users can only request supervisors **in their own organization**; supervisors only receive requests from their own organization. **Enforce in the database** (validated check on pending/accepted links), not only in app code.
- Self-requests are blocked.
- **Finding a supervisor:** a page lists all active supervisors in the user's organization, searchable by **first or last name**, each with a **Request supervision** button (disabled while a request is pending or accepted; shows "Request pending" with cancel).
- **Supervisor inbox:** a Requests page lists pending requests with **Accept** and **Decline**. A navigation badge shows the unread count.
- **Decline** needs no reason; the supervisee is notified (**Decided**, ASM-04).
- **Ending a link:** the supervisee, the supervisor, or an admin may end it. History and past approvals are kept; the supervisee can then request someone new.
- With no active supervisor, the supervisee sees a banner ("No active supervisor, request one"); entries remain Pending.
- **Race safety:** re-check organization and link state inside the accept transaction.

### 6.3 Notifications (in-app only)
- A `notifications` table, a navigation badge, and an inbox page. The client **polls** an unread-count endpoint (about every 60s and on window focus). No WebSockets and no email in v1.
- **Events:** supervision request received (supervisor). **Decided (ASM-04):** also notify supervisees when a request is accepted, declined, or ended, and when an entry is approved, rejected, or reverted.

---

## 7. Functional requirements

### 7.1 Entries

**Fields**

| Field | Rules |
|---|---|
| `session_date` | Required |
| `start_time`, `end_time` | **Required for new entries.** Local clock time, no timezone conversion. End must be after start; **no sessions across midnight; 15-minute steps** (**Decided**, ASM-02). Hours display to two decimals, for example 1.25 (**Decided**, ASM-06). |
| Hours | **Calculated** from start/end; never typed in. The server rejects client-sent hours. |
| `category` | Required; one of the 12 categories (section 8) |
| `clients` | Zero or more saved clients/groups (multi-select) |
| `on_site` | Boolean; counts toward Total Time On-site |
| `notes` | Optional free text. UI warns: pseudonyms only; supervisors can read notes. |
| `status` | `pending`, `approved`, `rejected` (default `pending`) |

**Overlaps:** a user's overlapping sessions are **blocked** with a clear message. The overlap check ignores rejected entries and legacy entries without times.

**Lifecycle**
```
Pending ──approve──► Approved (locked) ──revert (reason required)──► Pending
   │
   └──reject (reason required)──► Rejected ──edit & save──► Pending
```
- Approved entries are **locked**: no edit or delete until reverted.
- Saving an edited rejected entry sets it back to Pending.
- Every status change writes `entry_status_history` (who, when, from/to, reason).
- **Bulk approve:** supervisor selects several entries or a date range; runs in one transaction and reports any skipped entries. Updates are conditional (`WHERE status = 'pending'`) so concurrent actions cannot double-apply.

**Legacy imports:** entries imported from the prototype's Markdown have no times. They import flagged **"Needs time"**: they keep their hours and count toward goals but are excluded from schedules until a time is added. New entries always require times.

### 7.2 Goals and progress

| Goal | Default target | Counts |
|---|---|---|
| Direct Service | **1200** h | Category group Direct |
| Supervision | **100** h | Group Supervision + Individual Supervision combined |
| Total Activity | **3000** h | All categories |
| Total Time On-site | none (tracked only) | Entries with `on_site = true` |

- Targets are **per-user editable settings** (the defaults above), not hard-coded.
- **Approved hours drive progress.** Pending hours show as a lighter segment on the bar. Rejected hours are excluded.
- Progress bars show tick marks at 25/50/75% and have `role="progressbar"` with readable `aria-valuetext`.

### 7.3 Milestone celebrations
- Milestones at **25 / 50 / 75 / 100%** of each goal (not On-site).
- Triggered by **approved** hours. Store `last_celebrated_percent` per goal; when the user next loads the app, celebrate once for newly crossed milestones, then record it. Never replay on reload.
- Show a solid-color banner (cycling gold, lime, red) plus confetti; respect `prefers-reduced-motion`.
- Messages: 25%: "Good work, you're a quarter of the way to your {goal} goal! Keep it up!"; 50%: halfway; 75%: three-quarters, finish line is close; 100%: goal met.

### 7.4 Clients / groups
- Per-user saved list, unique case-insensitively. Added inline with a **+** button next to a checkbox multi-select dropdown. Selecting several is allowed. Entries show one client per line.

### 7.5 Supervisor dashboard
- Supervisor selects a supervisee and sees a **progress summary** per goal (approved vs pending hours), counts of pending and rejected entries, and last entry date.
- Drill down to the entries list (filters, sorting) with approve / reject / bulk approve / revert actions. Rejection and revert require a reason.
- Computed server-side with SQL aggregates; paginated.

### 7.6 Peer schedules ("Team Schedules" page)
- Visible to users who share the **same accepted supervisor** (**Decided**, ASM-01: supervisors also see their accepted supervisees).
- Search box (people within the peer group only; no global directory), then a **Monday–Friday week view** for the selected person. Week picker with previous / next / this week; defaults to the current week.
- **Read-only. Peers see only the time block and category.** Not client names, notes, hours, on-site flag, or approval status. **Rejected entries are hidden** (**Decided**, ASM-01). Weekend entries are not shown; display "N entries on weekend not shown" (**Decided**, ASM-02).
- URL-driven state (`?user=…&week=YYYY-MM-DD`). The grid collapses to a day list on narrow screens; keyboard accessible.
- The response uses a dedicated whitelisted DTO. **Never reuse the entry model.**

### 7.7 Import / export
- **Import** the prototype's `.md` ledger (section 12.3). Legacy rows get "Needs time." Re-importing skips exact duplicates (same date, category, hours, notes and client set) and reports them (**Decided**, ASM-07).
- **Export:** Markdown (round-trippable), CSV, and PDF. PDF is generated **in the browser**. Exports include start/end times. CSV cells are escaped against formula injection (SEC-37).

### 7.8 Admin console
- Users: invite/create, edit (name, roles, organization, email via re-invite), deactivate, permanently delete.
- Organizations: create, rename, delete (blocked if non-empty).
- Invite-only: Cognito self sign-up disabled, plus a **pre-sign-up Lambda** that checks the `invitations` allowlist (covers federated Google sign-ins).

---

## 8. Reference data

**Categories (12), grouped**

| Group | Categories |
|---|---|
| Direct Service | Individual Counseling · Group Facilitation · Intake Interviews · Couples / Family Therapy · Psychoeducation |
| Indirect Service | Writing Progress Notes / Documentation · Staff Meetings · Case Management · Assessment Scoring · Professional Development |
| Supervision | Group Supervision · Individual Supervision |

Store as lookup data (a `categories` table), so they can evolve.

---

## 9. Data model

Primary keys are UUIDs. All timestamps are `timestamptz` except session times (local clock).

| Table | Key columns |
|---|---|
| `organizations` | `id`, `name` (unique), `created_at` |
| `users` | `id`, `organization_id` (NOT NULL), `email` (citext, unique), `first_name`, `last_name`, `status` (`active`/`deactivated`), `cognito_sub` (nullable, unique), role mirror (`is_supervisor`, `is_admin`), `created_at`, `deactivated_at` |
| `invitations` | `id`, `email` (citext), `organization_id`, `roles`, `invited_by`, `created_at`, `expires_at`, `status` (`pending`/`accepted`/`revoked`), `accepted_at`; partial unique index on `email` where `status = 'pending'` (ADR-0010) |
| `categories` | `id`, `name`, `group` (`direct`/`indirect`/`supervision`), `sort_order` |
| `goals` | `id`, `user_id`, `goal_type`, `target_hours`, `last_celebrated_percent`; unique `(user_id, goal_type)` |
| `clients` | `id`, `user_id`, `name`; unique `(user_id, lower(name))` |
| `entries` | `id`, `user_id`, `session_date`, `start_time` (nullable, legacy), `end_time` (nullable, legacy), `duration_minutes`, `category_id`, `on_site`, `notes`, `status`, `needs_time`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at` |
| `entry_clients` | `entry_id`, `client_id` |
| `supervision_links` | `id`, `supervisee_id`, `supervisor_id`, `organization_id`, `status` (`pending`/`accepted`/`declined`/`cancelled`/`ended`), `requested_at`, `responded_at`, `ended_at`, `ended_by` |
| `entry_status_history` | `id`, `entry_id`, `from_status`, `to_status`, `changed_by` (nullable), `changed_by_name` (snapshot), `reason`, `changed_at` |
| `notifications` | `id`, `user_id`, `type`, `payload` (jsonb), `read_at`, `created_at` |
| `admin_audit_log` | `id`, `actor_id`, `actor_name`, `action`, `target_user_id`, `details` (jsonb), `created_at` |

**Constraints (enforce in the DB, not only in code)**
- `entries`: `end_time > start_time`; start and end both null or both set; `duration_minutes` consistent with times when present; minutes divisible by 15; **overlap exclusion** per user (via `btree_gist`) for non-rejected entries with times.
- `supervision_links`: partial unique index on `(supervisee_id)` where status is `pending` or `accepted`; `supervisor_id <> supervisee_id`; validation that supervisee and supervisor share the link's `organization_id` (trigger or equivalent).
- `invitations`: at most one `pending` invitation per email (partial unique index), so a re-invite after a delete or an email change does not collide; `expires_at` is checked by the pre-sign-up trigger, and **first sign-in** sets `status = 'accepted'` with `accepted_at` in the same transaction that binds `cognito_sub` (ADR-0010).
- Indexes for the schedule path: `(user_id, session_date, start_time)`.
- Keep approved-entry immutability enforced in the service layer with a DB-level backstop.

---

## 10. API

Base path `/api/v1`. The bearer credential is the Cognito **ID token**, validated by the API Gateway JWT authorizer on every route except `GET /healthz`, which has its own unauthenticated route (ADR-0008). The authorizer's own rejection is `application/json {"message":"Unauthorized"}`, not `problem+json`: HTTP APIs cannot customise gateway responses, and clients must tolerate it. JSON. Errors use RFC 7807 `application/problem+json`. List endpoints are paginated (default 50). `Idempotency-Key` header supported on POSTs that create or bulk-change data. The OpenAPI file is the contract.

| Area | Endpoints (illustrative) | Roles |
|---|---|---|
| Entries | CRUD on own entries; `POST /entries/{id}/revert-approval` (supervisor) | User / Supervisor |
| Clients | CRUD on own clients | User |
| Goals | Get and update own targets; progress summary | User |
| Import / export | `POST /import/markdown`; export data endpoints | User |
| Supervisors | `GET /supervisors?search=&page=` (same organization only) | User |
| Requests | create, cancel, list inbox, accept, decline; `POST /supervision-links/{id}/end` | User / Supervisor / Admin |
| Supervisor | list supervisees; supervisee summary; supervisee entries; approve / reject / bulk approve | Supervisor |
| Schedules | `GET /schedules/peers?search=`; `GET /schedules/{userId}?weekStart=` (must be a Monday) | User |
| Notifications | list; mark read; unread count | All |
| Admin | organizations CRUD; users create / edit / deactivate / delete; role assignment | Admin |

Observability: `/healthz`, structured JSON logs (`slog`) with request IDs, CloudWatch alarms on errors and 5xx, OpenTelemetry hooks where inexpensive. API Gateway throttling on all routes, with tighter limits on search.

---

## 11. Security requirements (non-negotiable)

### 11.1 Parameterized queries
**Every database query uses bound parameters.** No request, token, or file-import value is ever concatenated into SQL.
- All queries are static `.sql` files compiled by **sqlc** and run through pgx. Handlers never write SQL strings.
- Optional filters use optional named parameters in a single static query, never runtime-built SQL.
- **Sort columns and directions** cannot be parameters: use a fixed allowlist, otherwise return 400.
- **Name search:** escape `%` and `_` for `LIKE`, and cap term length.
- Migrations are static, reviewed SQL. The `.md` import parses to typed values first and uses parameterized inserts.
- The app's DB role is **least privilege**: data access only, with no DDL or superuser rights.
- **CI gates:** `gosec` (G201/G202), a Semgrep or lint rule forbidding string-built SQL (`fmt.Sprintf`, `+`) in query calls, and a check that sqlc output is current.
- **Tests:** injection payloads (`' OR 1=1 --`, `'; DROP TABLE …`, quotes, backslashes, `%`, `_`) against every endpoint taking text, search, or sort input, and inside crafted `.md` import rows.

### 11.2 Authorization
- **One central policy package** (`internal/authz`) used by every handler. Handlers do not hand-roll permission checks.
- Every query is scoped by the acting user's organization and relationship.
- Guard against IDOR: every `{userId}` or `{entryId}` path parameter is checked against the actor's rights.
- Claims are read **only** from the API Gateway authorizer context, never parsed from the `Authorization` header (the API Lambda has no internet, so it cannot fetch JWKS to validate a token itself). A request with no authorizer context is refused with 401 (ADR-0008).
- Roles come from the `users` row. Cognito group claims are advisory only until S5-05 assigns groups: the seeded first admin has no Cognito user until their first sign-in, so a claim can never be required for a privileged check.
- **Required negative tests:** cross-organization requests, cross-organization supervisor lookup, viewing a non-peer's schedule, supervisor acting on a non-supervisee, non-admin calling admin routes, admin reading entries without a link.

### 11.3 Data exposure
- Dedicated response DTOs with explicit field lists; peer and supervisor views never serialize the raw entry model. Tests assert client names and notes cannot leak in peer responses.
- Clearly warn in the UI (client field, notes field) that only pseudonyms or initials belong there.

### 11.4 Infrastructure
- IAM least privilege per function. TLS everywhere. Encryption at rest (RDS, S3). S3 buckets private with Block Public Access (CloudFront via OAC). No open CIDR blocks; DB in private subnets.
- Secrets (for example the Google OAuth client secret) live in Secrets Manager and are referenced by CDK, never committed.
- Dependency hygiene: `govulncheck`, `npm audit`, Dependabot or equivalent.
- Request body size limit at API Gateway; validate lengths and types on all fields.

---

## 12. Frontend and design

### 12.1 Existing prototype
A working single-file HTML app (`therapy-hours-tracker.html`) defines the UX to port. It stored data in browser memory and persisted to a Markdown file via the File System Access API. **The server database replaces that**; keep the UX, retire the file-handle and unsaved-changes reminder logic.

**UX to preserve**
- Layout: header with title and kicker, a goal-cards row, then a two-column board (entry form on the left, entries table on the right). Page max-width about 1600px; form column about 380px.
- Entry form fields in this order: date, category (dropdown grouped by Direct / Indirect / Supervision), start and end time (**replaces the Hours field**; show calculated hours read-only), client/group dropdown with +, on-site checkbox, notes. Clear validation messages (a toast) instead of silent failure.
- Entries table: sortable columns (Date, Category, Client, Hours, On-site) with ▲/▼ indicators and `aria-sort`; resizable columns using percentage widths; filters for group, client text, and date range; **Clear filters**, Export, and Import buttons on the "Entries" header row; per-row Edit / Delete; client names one per line; group badges; empty and "no matches" states. Default sort is newest first.
- Goal cards with ruler-style progress bars and tick marks. The Supervision card shows the group/individual split.
- Category sort groups by group first, then category name.
- Add new: **approval status chips** on entries (Pending / Approved / Rejected with reason), supervisor pages, Team Schedules, Admin, Notifications.

### 12.2 Theme tokens

| Token | Value |
|---|---|
| Gold / deep | `#CF900B` / `#362404` |
| Lime / deep | `#ABCF0B` / `#253006` |
| Red / deep | `#CF2E0B` / `#7A1C07` |
| Text ink / soft | `#3A2A16` / `#7D6A54` |
| Paper / raised | `#FBF8F1` / `#FFFFFF` |
| Primary button | fill `#283407`, white text, hover ink `#3A2A16` |
| Ghost button | lime-deep outline and text; hover fills with white text |
| Focus ring | red-deep, 2px |
| Fonts | **Fredoka** for headers and section titles; **Inter** for everything else, including numbers (use tabular figures) |

- Page background: soft radial washes of gold, red, and lime over the paper color with faint ruled lines.
- Category badges: Direct = gold tint, Indirect = lime tint, Supervision = red tint.
- Goal bars: Direct = gold, Supervision = red, Total Activity = lime.
- **Accessibility:** text contrast at least 4.5:1 (WCAG AA); real `<button>` elements for sort controls; labelled inputs; `role="progressbar"` bars; respect `prefers-reduced-motion`; mobile fallback for the schedule grid.

### 12.3 Prototype Markdown format (import compatibility)
```
# Clinical Hours Ledger
## Summary
- Direct Service: X / 1200 hours
...
## Clients / Groups
- Name A
- Name B
## Entries
| Date | Group | Category | Client | Hours | On-site | Notes |
|---|---|---|---|---|---|---|
| 2026-01-05 | Direct Service | Individual Counseling | A; B | 1.5 | Yes | text |
```
- Multiple clients are separated by `; `. A literal `|` in a cell is escaped as `\|`. A client of `—` or empty means none.
- Older files may have a single client and no `Clients / Groups` section: merge client names found in entries into the saved list (case-insensitive de-dupe).
- **New export format** adds `Start` and `End` columns; the importer must accept both layouts (no times means "Needs time").

---

## 13. CI/CD

Single pipeline in the infra repo (**Accepted, ADR-0005**):

1. **Source:** all three repos via GitHub CodeConnections
2. **Build and test (parallel, fail fast):** `golangci-lint`, `gosec`, `govulncheck`, Go tests; `eslint`, `tsc`, frontend tests; `cdk synth`
3. **Deploy dev:** data stack, then **run migrations** (CodeBuild invokes the migration Lambda), then app stack and frontend sync, then **smoke tests** (health check plus a basic authenticated call)
4. **Manual approval** (shows the commit SHAs of all three repos)
5. **Deploy prod** in the same order, after an RDS snapshot

**PR gates run in GitHub Actions; CodePipeline handles build, deploy and promotion after merge** (**Decided** 2026-10-10). Each repo's workflows run its lint, type check, tests and security gates on every pull request so branch protection can require them. Third-party Actions are pinned to full commit SHAs and workflows use least-privilege `permissions` (`contents: read`). Deploys never run from GitHub Actions.

Migrations are **forward-only**, additive-first, and must be safe to run before the new code goes live (expand/contract). Preview deploys are out of scope for v1.

---

## 14. Testing strategy

| Layer | Approach |
|---|---|
| Go unit | Table-driven; business rules (lifecycle, overlap, goal math, milestone crossing) |
| Go integration | **Testcontainers PostgreSQL** (not in-memory DBs); migrations applied for real; authz negative tests; injection tests |
| API contract | OpenAPI validation in CI |
| Frontend unit and integration | React Testing Library focused on user behavior; **MSW** to mock the API |
| Sign-in tests | Playwright and the authenticated smoke check sign in through a **dev-only password app client** with synthetic users (ADR-0011); nothing drives Google's consent screen, and the federated path is demonstrated manually per slice |
| E2E (Playwright) | Critical paths: invited sign-in; log an entry; request a supervisor; accept; approve, reject, and revert; peer schedule; admin invite and role change; import of the prototype `.md` |
| Visual / accessibility | axe checks on key pages; watch the schedule grid and progress bars |

---

## 15. Delivery plan

Backlog epics, in suggested order. Each story must be 2 days or less and include acceptance criteria and a DoD.

| # | Epic | Notes / dependencies |
|---|---|---|
| E1 | **Foundation:** repos, CDK network/DB/auth/API/web, pipeline, dev and prod, alarms | Everything depends on this |
| E2 | **Auth and invites:** Cognito + Google, invite-only, pre-sign-up check, first-admin seed | Requires E1 |
| E3 | **Core logging:** schema (including times from day 1), entries, clients, goals, categories, entries UI | **Schema must include time fields in the first migration** |
| E4 | **Import / export:** Markdown import (legacy "Needs time"), Markdown / CSV / browser PDF export | Requires E3 |
| E5 | **Organizations and admin:** org CRUD, user management, role assignment, audit log | Requires E2; split identity/data Lambda and Step Functions here |
| E6 | **Supervision links:** supervisor search, requests, inbox, accept/decline/end, notifications | Requires E5 |
| E7 | **Review workflow:** statuses, approve/reject/bulk, revert, history, status UI, approved-hours progress, milestone logic | Requires E3, E6 |
| E8 | **Supervisor dashboard and peer schedules** | Requires E6, E7 |
| E9 | **Hardening:** authorization negative tests, injection suite, load sanity, docs, runbook | Continuous; finish before go-live |

---

## 16. Recorded decisions (2026-10-10)

The owner confirmed every planning default and accepted every Recommended design:

1. Peers do not see rejected entries; supervisors also get the Team Schedules page for their supervisees (ASM-01).
2. Sessions cannot cross midnight; 15-minute increments; weekend entries are allowed but hidden from the Monday–Friday grid with a count hint (ASM-02).
3. The first organization is seeded as "Default Organization" (ASM-03).
4. Supervisees are notified of request outcomes and entry reviews; decline needs no reason; self-requests are blocked (ASM-04).
5. Changing a user's organization automatically ends their supervision link and cancels pending requests, after a confirmation (ASM-05).
6. Hours display to two decimals (ASM-06). Re-imports skip exact duplicates and report them (ASM-07).
7. Sign-in is Google only (OQ-01). Supervisors see zero-progress cards for supervisees with no approved hours (OQ-02). The 7-day prod backup window after permanent deletion is accepted (OQ-03).
8. **ADR-0001 to ADR-0006 are Accepted** (`docs/adr/`): RDS IAM auth, admin-orchestrator + identity + data step with Step Functions, the migration Lambda, CloudFront `/api/*` routing with a CloudFront Function for SPA routes, the single infra-owned pipeline, and the OpenAPI contract with codegen and drift gate.

**Known risks:** cross-organization data leakage and IDOR (mitigated by central authz, a DB-level organization check, and negative tests); Lambda connection exhaustion (pool size and reserved concurrency); supervisors missing in-app-only notifications (badge and polling now, email later); budget drift if a disallowed service is added.
