# S1: Secure sign-in

> **Milestone:** M2 · **Tickets:** 20 · **Estimate:** 23.5 developer-days

## Slice goal
Invite-only Google sign-in with roles, the first admin, and the authorization framework every later slice uses.

## Demo / acceptance of the slice
An invited Google account signs in and sees its name and role-based navigation; an uninvited account is refused; a deactivated account is refused.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Execution status (2026-10-11)

**7 done** · **9 in progress** · **0 in review** · **4 not started**

The accepted plan contains 20 tickets. ADRs, schema, read-only trigger role, claims adapter, profile contracts and central authorization policies are merged. Backend identity/profile implementation is released; database seed idempotency and synthetic admission are verified. Gateway protection, CSP/runtime settings and browser PKCE sign-in are prepared for paired review. Auth remains disabled. Native fixture creation, real Google federation, measured p99, live E2E and the remaining role-specific shell work are outstanding.

**Status legend:** done = merged implementation; in progress = partial implementation or remaining acceptance; in review = open PR; not started = implementation has not begun. Completion notes distinguish dev verification from deferred prod/manual acceptance. Acceptance checkboxes are not automatically checked from merge status.

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by | Status |
|---|---|---|--:|---|---|
| [S1-02](#s1-02) | Spike | Spike: auth design decisions (token, binding, allowlist, test users, storage) | 1 | S0-02 | done |
| [S1-04](#s1-04) | Story | Migration: organizations, users, invitations; seed Default Organization | 1.5 | S0-10 | done |
| [S1-17](#s1-17) | Task | Read-only database role for the pre-sign-up trigger | 1 | S0-08 | done |
| [S1-01](#s1-01) | Story | Cognito user pool, Google IdP, app client, hosted UI, secrets and token settings | 2 | S0-15, S1-02 | in progress |
| [S1-18](#s1-18) | Spike | Spike proof: federated binding and trigger latency measured on dev | 0.5 | S1-01, S1-03 | not started |
| [S1-03](#s1-03) | Story | PreSignUp Lambda enforcing the invitation allowlist | 1.5 | S1-01, S1-04, S1-17 | in progress |
| [S1-14](#s1-14) | Task | API Gateway JWT authorizer with a public /healthz route | 1 | S1-01 | in progress |
| [S1-15](#s1-15) | Task | Authorizer claims through the Lambda adapter | 0.5 | S0-03 | done |
| [S1-05](#s1-05) | Task | OpenAPI: /me and the shared Problem responses | 1 | S0-19 | done |
| [S1-19](#s1-19) | Task | Frontend spec sync and /me handler, released with S1-05 | 0.5 | S1-05 | done |
| [S1-06](#s1-06) | Story | Auth middleware: claims to actor, user lookup, sub binding, deactivated check | 2 | S1-04, S1-05, S1-14, S1-15, S0-09 | in progress |
| [S1-07](#s1-07) | Story | internal/authz policy framework | 1.5 | S1-06 | done |
| [S1-08](#s1-08) | Story | GET /me endpoint | 1 | S1-06, S1-07 | in progress |
| [S1-09](#s1-09) | Task | Seed Lambda: first admin, Default Organization and dev test users | 1 | S1-04, S1-01 | in progress |
| [S1-20](#s1-20) | Task | Break-glass admin recovery runbook entry | 0.5 | S1-09 | not started |
| [S1-16](#s1-16) | Task | CSP connect-src for the Cognito hosted UI domain | 0.5 | S1-01 | in progress |
| [S1-10](#s1-10) | Story | Frontend auth: Cognito hosted UI (code + PKCE), AuthProvider, route guards | 2 | S1-01, S1-08, S1-16, S0-19 | in progress |
| [S1-11](#s1-11) | Story | App shell: header, role-aware nav, landing and access-denied pages | 1.5 | S1-10 | in progress |
| [S1-12](#s1-12) | Task | Role authority and token staleness: tests and runbook note | 1 | S1-06 | not started |
| [S1-13](#s1-13) | Task | E2E: invited sign-in and denied sign-in | 2 | S1-11, S1-09, S1-03 | not started |

---

### S1-02
**Spike: auth design decisions (token, binding, allowlist, test users, storage)**

| Field | Value |
|---|---|
| Issue Type | Spike |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | spike, auth, decision |
| Requirements | FR-AUTH-01, FR-AUTH-03 |
| Stories | US-01 |
| Is blocked by | S0-02 |
| Blocks | S1-01, S5-05 |
| Status (2026-10-11) | done |

**Completion / progress**

Owner accepted ADR-0008–0011 on 2026-10-11; decisions are merged in all three repositories. Live binding and latency proof are separate S1-18 acceptance work.

Merged PRs: [backend #17](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/17), [frontend #18](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/18), [infra #30](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/30).

**Description**

Decision-first half of the spike, before any auth code. OQ-01 is already decided (Google sign-in only). Settle and record the five S1 decisions the plan review raised: which token the SPA sends and which claims the API may trust (ADR-0008), how a federated Google user binds to an existing users row (ADR-0008), where the pre-sign-up allowlist is read from and how it fits Cognito's fixed 5 second synchronous trigger budget (ADR-0007), how the invitation lifecycle and just-in-time user provisioning work (ADR-0010), and how automated sign-in tests get a token without driving Google's consent screen (ADR-0011). ADR-0009 records where the user pool lives and how callback URLs are configured.

**Acceptance criteria**

- [ ] ADR-0008 to ADR-0011 written and accepted by the owner before S1-01 starts (ADR-0007 accepted 2026-10-11)
- [ ] The token decision names the claim the user lookup uses and is reflected in api/openapi.yaml wording
- [ ] Token storage and page-reload behaviour recorded against SEC-35 and FE-61
- [ ] Test-user strategy recorded, including any accepted deviation from SEC-01
- [ ] No implementation in this ticket

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-04
**Migration: organizations, users, invitations; seed Default Organization**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db, adr-0010 |
| Requirements | FR-AUTH-02, FR-AUTH-03 |
| Stories | US-46 |
| Is blocked by | S0-10 |
| Blocks | S1-03, S1-06, S1-09, S2-01, S5-01, S6-01 |
| Status (2026-10-11) | done |

**Completion / progress**

Identity migration and sqlc lookups are merged and applied on dev; PostgreSQL lifecycle, uniqueness and idempotency tests pass.

Merged PRs: [backend #20](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/20).

**Description**

goose migration creating the tables per CLAUDE.md §9 with citext email uniqueness, NOT NULL organization, role mirror columns, status check; sqlc queries for lookup by email and by sub. Invitations carry the lifecycle ADR-0010 settles: expires_at, status (pending, accepted, revoked) and a partial unique index on email for pending invitations only, so a re-invite after a delete or an email change does not collide.

**Acceptance criteria**

- [ ] Applies cleanly via migrate Lambda
- [ ] users.email unique case-insensitively
- [ ] invitations has expires_at and status, with a partial unique index on email where status is pending
- [ ] Default Organization row created idempotently
- [ ] Default invitation validity documented in the runbook

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-17
**Read-only database role for the pre-sign-up trigger**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, backend, db, adr-0001 |
| Requirements | NFR-SEC-01, NFR-SEC-04 |
| Stories | US-39 |
| Is blocked by | S0-08 |
| Blocks | S1-03 |
| Status (2026-10-11) | done |

**Completion / progress**

presignup_ro bootstrap and exact SELECT grants on users/invitations are merged and deployed. Negative privilege tests cover writes and unrelated future tables; the deployed trigger uses its scoped IAM connection.

Merged PRs: [backend #21](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/21), [infra #31](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/31).

**Description**

Extend the S0-08 role bootstrap with a third IAM role, presignup_ro, that may only SELECT the invitations and users tables. The bootstrap creates the role before migrations. S1-04 grants SELECT on exactly users and invitations at table creation; bootstrap also grants those existing tables when deployed later. Broad ALTER DEFAULT PRIVILEGES grants are forbidden because they would expose future client-data tables. Scope rds-db:connect to that database user only, following the pattern in lib/app/api.ts.

**Acceptance criteria**

- [ ] Bootstrap is still idempotent when re-run
- [ ] presignup_ro cannot INSERT, UPDATE or DELETE (negative test)
- [ ] Exact table privileges are granted with S1-04; bootstrap then migration and repeated bootstrap are verified, and unrelated future tables remain unreadable
- [ ] rds-db:connect names the one database user, no wildcard

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-01
**Cognito user pool, Google IdP, app client, hosted UI, secrets and token settings**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, auth, adr-0009 |
| Requirements | FR-AUTH-01, NFR-SEC-04 |
| Stories | US-01 |
| Is blocked by | S0-15, S1-02 |
| Blocks | S1-18, S1-03, S1-14, S1-09, S1-16, S1-10, S5-04 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Cognito pool, Google IdP, clients and typed configuration are merged and synth-tested. The dev secret, matching Google client ID and saved redirect URI were verified. Read-only review verified the three basic identity scopes and External/Testing audience. Auth is disabled and no pool is deployed; activation and live federation verification remain.

Merged PRs: [infra #32](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/32).

**Description**

CDK auth construct in the data stack (ADR-0009, the pool is stateful): user pool with self sign-up disabled, groups admin and supervisor, Google identity provider with attribute mapping, client secret from Secrets Manager (owner creates the Google OAuth client), app client with code plus PKCE and token revocation enabled, hosted UI domain, and callback and logout URLs read from EnvConfig rather than from a CloudFront stack reference, which would make the Web and App stacks circular. Dev config also gets the test-only app client ADR-0011 defines.

**Acceptance criteria**

- [ ] Pool lives in the data stack with a retain policy in prod, and the runbook says how to re-bind cognito_sub if a pool is ever replaced
- [ ] Google attribute mapping covers email, email_verified, given_name and family_name, and email is the pool alias attribute
- [ ] Google OAuth client id and secret come from Secrets Manager per environment, not committed, and the authorized redirect URI is the hosted UI oauth2/idpresponse URL
- [ ] Callback and logout URLs come from EnvConfig; dev uses the live CloudFront domain and prod carries documented synth-valid placeholders until M3
- [ ] Access and ID token validity 60 minutes, refresh token 7 days, token revocation enabled (SEC-04)
- [ ] Cognito feature plan and hosted UI flavour chosen and recorded, with the monthly cost noted against NFR-COST-01
- [ ] Self sign-up disabled

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-18
**Spike proof: federated binding and trigger latency measured on dev**

| Field | Value |
|---|---|
| Issue Type | Spike |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 0.5 day(s) · 1 points |
| Labels | spike, auth, adr-0007 |
| Requirements | FR-AUTH-01, FR-AUTH-03 |
| Stories | US-01 |
| Is blocked by | S1-01, S1-03 |
| Blocks | - |
| Status (2026-10-11) | not started |

**Description**

Second half of the spike, once the pool exists. Prove on dev what ADR-0007 and ADR-0008 assume: that a first federated sign-in produces exactly one Cognito identity for an invited email, that a second sign-in reuses it, and that the pre-sign-up trigger answers inside Cognito's 5 second budget on a cold start.

**Acceptance criteria**

- [ ] First sign-in creates one Cognito user and binds one cognito_sub; a second sign-in reuses both
- [ ] Measured cold-start and warm pre-sign-up duration recorded, with the p99 against the 5 second ceiling
- [ ] Findings appended to ADR-0007 and ADR-0008, including whether provisioned concurrency is needed

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-03
**PreSignUp Lambda enforcing the invitation allowlist**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, auth, db, adr-0007 |
| Requirements | FR-AUTH-01, FR-AUTH-05 |
| Stories | US-02 |
| Is blocked by | S1-01, S1-04, S1-17 |
| Blocks | S1-18, S1-13, S5-11 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Backend and infra are merged and released in dev execution 7c97ec40-371c-4387-8c26-817c75450d4c. The arm64 live alias is READY with reserved concurrency 1 and provisioned concurrency 1/1. A synthetic uninvited Google event returned SIGN_UP_NOT_ALLOWED; the decision log had only safe fields and no email. Policy and PostgreSQL tests pass. The single 66 ms sample is not p99 proof; actual federated acceptance and measured cold/warm p99 remain. The pipeline build-list bootstrap issue was repaired before release. Two provisioned cold initialization samples were 2805.16 and 3057.93 ms; these small samples do not establish p99.

Merged PRs: [backend #22](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/22), [infra #33](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/33).

**Description**

VPC Lambda trigger connecting as presignup_ro with RDS IAM auth; rejects emails with no pending unexpired invitation, and emails belonging to deactivated users; covers federated Google sign-ins. Cognito's synchronous trigger timeout is a fixed 5 seconds and the backend's own IAM connect timeout is 12 seconds (internal/db/pool.go), so this ticket must prove the latency, not assume it: keep the connect timeout under the ceiling, size provisioned concurrency per ADR-0007, and fail closed with a stable error code. Adding the function also means adding presignup to BACKEND_LAMBDAS and BackendLambda in the infra repo, which only works after the backend binary is in a released build.

**Acceptance criteria**

- [ ] Uninvited Google email is rejected with a stable error code
- [ ] Invited email with a pending unexpired invitation passes
- [ ] Expired or already-accepted invitation is rejected
- [ ] Email of a deactivated user is rejected, and the ticket records that this only covers accounts that have never signed up (a returning account is stopped by the API, see S1-06)
- [ ] Trigger p99 duration on a cold start is under 5 seconds, measured not assumed
- [ ] Lambda has no internet, and no write rights on any table
- [ ] Backend binary released before the infra PR that adds presignup to BACKEND_LAMBDAS

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-14
**API Gateway JWT authorizer with a public /healthz route**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, backend, auth, security |
| Requirements | FR-AUTH-04, NFR-SEC-04 |
| Stories | US-01, US-42 |
| Is blocked by | S1-01 |
| Blocks | S1-06 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Prepared Gateway JWT authorizer with issuer and SPA/dev-only test audiences; exactly one public health route is asserted for enabled environments. No-token release checks and scoped native invited/uninvited /me plus authenticated unknown-path checks are prepared. Default auth remains disabled; live activation acceptance is pending.

**Description**

S0 built one route, ANY /api/v1/{proxy+} (lib/app/api.ts), and API Gateway attaches authorizers per route, so protecting the API as it stands also protects /healthz. SEC-03 and the spec's security: [] on /healthz both require the exemption. Split /healthz onto its own unauthenticated route, attach the Cognito JWT authorizer to the proxy route with issuer and audience from the pool, and keep the release gates working: scripts/smoke.sh and the frontend Playwright spec both call /api/v1/healthz and an unknown API path without a token.

**Acceptance criteria**

- [ ] GET /api/v1/healthz is reachable without a token and still returns the Go handler's JSON with security headers
- [ ] Every other route requires a valid Cognito token, with issuer and audience checked
- [ ] scripts/smoke.sh passes unchanged against dev
- [ ] The unknown-API-path gate is updated to assert 401 without a token and problem+json 404 with one
- [ ] A synth test asserts exactly one unauthenticated route exists
- [ ] The smoke script gains one authenticated request against a protected route, using the ADR-0011 dev credentials, so the gate proves the authorizer works

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-15
**Authorizer claims through the Lambda adapter**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 0.5 day(s) · 1 points |
| Labels | backend, auth, security |
| Requirements | FR-AUTH-04, NFR-SEC-02 |
| Stories | US-01 |
| Is blocked by | S0-03 |
| Blocks | S1-06 |
| Status (2026-10-11) | done |

**Completion / progress**

Trusted authorizer claims are carried through the Lambda adapter and released to dev. Protected-route integration remains S1-06/S1-14.

Merged PRs: [backend #18](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/18).

**Description**

internal/apigw.toHTTPRequest copies path, method, query, body, headers and cookies and drops event.RequestContext.Authorizer, so the middleware has no validated claims to read. Parsing the bearer token in the handler is not an option: validating it needs Cognito's JWKS and the API Lambda has no internet (no NAT), and trusting unvalidated claims would be an auth bypass. Carry the authorizer's JWT claims into the request context instead.

**Acceptance criteria**

- [ ] Claims reach the handler only through the authorizer context, never from the Authorization header
- [ ] A request with no authorizer context is refused with 401 and logs no token material (SEC-50)
- [ ] The local HTTP development path cannot supply claims when running on Lambda, asserted by a test
- [ ] Adapter unit tests cover a claims-present and a claims-absent event

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-05
**OpenAPI: /me and the shared Problem responses**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api, adr-0006 |
| Requirements | FR-AUTH-04 |
| Stories | US-01 |
| Is blocked by | S0-19 |
| Blocks | S1-19, S1-06 |
| Status (2026-10-11) | done |

**Completion / progress**

The /me contract and shared auth Problem responses are merged and released with frontend S1-19. The real /me endpoint remains S1-08.

Merged PRs: [backend #19](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/19).

**Description**

Spec GET /me (id, name, email, roles, organization) and the shared 401, 403 and 404 problem responses; regenerate the server interface. The bearer security scheme already exists from S0-04, so this ticket only narrows its description to the token ADR-0008 chose. It also documents the one response the API does not control: API Gateway's own 401 is application/json {message}, not problem+json, because HTTP APIs cannot customise gateway responses.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] The security scheme names the token type the SPA actually sends
- [ ] The 401 description says the authorizer's own 401 is not problem+json
- [ ] Examples contain only fictional data
- [ ] Frontend drift gate passes in the same release, see S1-19

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-19
**Frontend spec sync and /me handler, released with S1-05**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 0.5 day(s) · 1 points |
| Labels | frontend, api, adr-0006 |
| Requirements | NFR-DOC-01 |
| Stories | US-01 |
| Is blocked by | S1-05 |
| Blocks | - |
| Status (2026-10-11) | done |

**Completion / progress**

Frontend /me spec, generated types and test handler are merged and released with backend S1-05. The API drift gate and frontend tests pass; real endpoint/auth UI work remains S1-08/S1-10.

Merged PRs: [frontend #19](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/19).

**Description**

The drift gate compares the pinned spec to the backend spec byte for byte (scripts/api-drift.mjs) in the build stage, and the MSW coverage test requires one handler per spec path, so a backend spec change on its own turns the pipeline red for all three repos. This ticket carries the frontend half of S1-05 and must reach main in the same release.

**Acceptance criteria**

- [ ] npm run api:sync updates the pinned copy and records the backend SHA
- [ ] An MSW handler exists for /me and the handlers-coverage test passes
- [ ] npm run api:drift is green against the backend commit being released
- [ ] Merged in the same pipeline run as S1-05, or immediately after it with no release in between

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-06
**Auth middleware: claims to actor, user lookup, sub binding, deactivated check**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, auth, security, adr-0010 |
| Requirements | FR-AUTH-03, FR-AUTH-04, FR-AUTH-05 |
| Stories | US-01, US-02 |
| Is blocked by | S1-04, S1-05, S1-14, S1-15, S0-09 |
| Blocks | S1-07, S1-08, S1-12 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Backend #24 is merged and released in successful dev execution af3e6963-7cf5-4857-bfc8-c0a524ba1355. Transactional actor resolution/binding, current database roles/status and the lazy two-connection IAM pool pass race/PostgreSQL/privacy checks. Auth stays disabled; actual Gateway/native/Google token acceptance remains with S1-14 and activation.

Merged PRs: [backend #24](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/24).

**Description**

Wire the pgx pool into cmd/api, which has no database today, then resolve the actor from the validated claims in the authorizer context: look the user up by the claim ADR-0008 chose, bind cognito_sub on first sign-in inside one transaction, provision the users row from a pending invitation on first sign-in and stamp invitations.accepted_at (ADR-0010), refuse deactivated users, and take roles from the users row only. Group claims are advisory in S1 because nothing assigns Cognito groups until S5-05, and the seeded first admin has no Cognito user at all until they first sign in.

**Acceptance criteria**

- [ ] First sign-in binds sub once; concurrent first requests do not duplicate, enforced by the unique index and ON CONFLICT rather than read-then-write
- [ ] First sign-in of an invited user creates the users row and stamps the invitation accepted
- [ ] Deactivated user gets 403 even with a valid token
- [ ] Roles come from the users row; a role present only in the token is ignored
- [ ] Pool stays at 2 connections per instance so the reserved-concurrency maths in config/types.ts still holds

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-07
**internal/authz policy framework**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, security |
| Requirements | NFR-SEC-02, FR-AUTH-04 |
| Stories | US-44 |
| Is blocked by | S1-06 |
| Blocks | S1-08, S2-05, S2-06, S2-07, S3-03, S5-03, S8-02, S10-03 |
| Status (2026-10-11) | done |

**Completion / progress**

Backend #24 is merged and released. Central active-actor, same-org self/admin/supervisor/peer policies deny by default, require accepted relationships and reject storage errors. Admin grants no supervision override. /me demonstrates the handler policy call; later slices implement relationship storage.

Merged PRs: [backend #24](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/24).

**Description**

Central policy package: Actor type, role predicates, relationship checks interface (same org, supervisor-of), helper that handlers must call; lint/test that handlers reference authz.

**Acceptance criteria**

- [ ] Table-driven unit tests for policy functions
- [ ] Handler template demonstrates usage
- [ ] Role predicates read the database-backed actor, not token claims
- [ ] Documented contract for later slices

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-08
**GET /me endpoint**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, api |
| Requirements | FR-AUTH-04 |
| Stories | US-01 |
| Is blocked by | S1-06, S1-07 |
| Blocks | S1-10 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Backend #24 is merged and released. The explicit /me DTO, no-store JSON and stable 401/403 problems pass schema/privacy tests; deployed unauthenticated /me returns 401 problem+json. Actual authenticated Gateway acceptance remains pending with activation.

Merged PRs: [backend #24](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/24).

**Description**

Returns the current user's profile, roles and organization via a dedicated DTO.

**Acceptance criteria**

- [ ] Returns 200 for active user
- [ ] 401 without token
- [ ] 403 with a stable problem type when the token is valid but the account is not usable, which is what the access-denied page renders
- [ ] DTO contains explicit fields only

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-09
**Seed Lambda: first admin, Default Organization and dev test users**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, backend, scripts, adr-0011 |
| Requirements | FR-AUTH-02 |
| Stories | US-46 |
| Is blocked by | S1-04, S1-01 |
| Blocks | S1-20, S1-13 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Backend #23 and infra #35/#36 are merged and released in successful dev execution 2a38a300-3311-43f7-9552-d07875d6e696. Seeding created three accounts and three invitations; a repeat under the same scoped operator created/renewed none. Synthetic Google events for invited and supervisor fixtures were allowed, while uninvited was denied. Auth remains disabled; the native Cognito fixture phase remains pending.

Merged PRs: [backend #23](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/23), [infra #35](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/35), [infra #36](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/36).

**Description**

There is no direct database access in any environment (no bastion, by budget), so seeding is a VPC Lambda invoked by a thin script, following ADR-0003's pattern for migrate. It idempotently creates the Default Organization, the first admin's invitation and users row, and in dev only the invitations and users rows for the test accounts ADR-0011 needs. The Cognito half of those test accounts cannot live here, because Cognito admin APIs are unreachable from the VPC (CLAUDE.md §4.1): a non-VPC pipeline step creates them. Adding the function means adding it to BACKEND_LAMBDAS and BackendLambda after the backend binary is in a released build.

**Acceptance criteria**

- [ ] Running twice changes nothing
- [ ] Creates the admin users row, not only the invitation, so the first sign-in has a row to bind to
- [ ] Dev-only test invitations and rows are impossible to create against prod, and the non-VPC step that creates their Cognito users runs on the dev stage only
- [ ] Prod seeding requires an explicit flag
- [ ] Backend binary released before the infra PR that adds the function
- [ ] Where it runs is decided and documented: a pipeline step after migrate, or a one-time owner invocation

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-20
**Break-glass admin recovery runbook entry**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 0.5 day(s) · 1 points |
| Labels | infra, docs, scripts |
| Requirements | FR-AUTH-02, NFR-DOC-01 |
| Stories | US-46 |
| Is blocked by | S1-09 |
| Blocks | - |
| Status (2026-10-11) | not started |

**Description**

Sign-in is Google only and SEC-07 forbids a backdoor, so if the single admin's Google account becomes unreachable there is no documented way back in. Record the procedure and make the seed Lambda support it.

**Acceptance criteria**

- [ ] Runbook section says exactly how to add a second admin by invoking the seed Lambda, with the explicit prod flag
- [ ] The seed Lambda accepts an additional admin email
- [ ] A second admin address is seeded, or the owner records the decision not to

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-16
**CSP connect-src for the Cognito hosted UI domain**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 0.5 day(s) · 1 points |
| Labels | infra, frontend, security, adr-0004 |
| Requirements | NFR-SEC-05, FR-AUTH-06 |
| Stories | US-01 |
| Is blocked by | S1-01 |
| Blocks | S1-10 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Prepared exact Cognito origin in CloudFront and local CSP, strict header assertions, and no unsafe directives. Public runtime auth settings are validated, uploaded without caching and invalidated with index.html. Paired infra/frontend release and live activation remain pending.

**Description**

lib/app/web.ts sets connect-src 'self' and says in a comment that S1 adds the Cognito domain. The hosted UI redirect is a top-level navigation and is unaffected, but the PKCE code-for-token POST goes to the hosted UI origin and is blocked by the current policy, silently in the browser, while every header check stays green.

**Acceptance criteria**

- [ ] The CloudFront response headers policy includes the hosted UI origin in connect-src
- [ ] The local development server in e2e serves the same policy
- [ ] The Playwright header assertion requires connect-src to contain that origin
- [ ] No 'unsafe-inline' or 'unsafe-eval' is added (SEC-32)

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-10
**Frontend auth: Cognito hosted UI (code + PKCE), AuthProvider, route guards**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend, auth |
| Requirements | FR-AUTH-01, FR-AUTH-06 |
| Stories | US-01 |
| Is blocked by | S1-01, S1-08, S1-16, S0-19 |
| Blocks | S1-11 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Prepared code/PKCE browser flow with state/nonce validation, callback URL cleanup, memory-only tokens, single-flight refresh and revocation plus hosted logout. 401/403 handling clears private cache and routes safely. Unit and intercepted browser tests cover replay, reload, refresh races, logout and denied profiles. Real Google sign-in/sign-out remain pending after activation.

**Description**

Redirect flow, tokens in memory with refresh, AuthProvider and useAuth, protected routes, 401 handling in the API client. Two details the plan review added: sign-out must hit the hosted UI logout endpoint and revoke the refresh token (SEC-04), and the callback route must handle Cognito's error and error_description parameters, which is how a pre-sign-up rejection comes back to the SPA.

**Acceptance criteria**

- [ ] Sign-in and sign-out work end to end on dev, and sign-out revokes the refresh token
- [ ] Tokens are in memory only, not in localStorage or sessionStorage
- [ ] Page-reload behaviour matches the ADR-0008 decision and is covered by a test
- [ ] A callback carrying error and error_description routes to the access-denied page
- [ ] A 401 whose body is not problem+json still redirects cleanly to sign-in
- [ ] Expired session redirects to sign-in

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-11
**App shell: header, role-aware nav, landing and access-denied pages**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | frontend, ux |
| Requirements | FR-AUTH-06 |
| Stories | US-01, US-02 |
| Is blocked by | S1-10 |
| Blocks | S1-13, S5-13, S6-09, S6-11, S8-04, S10-05 |
| Status (2026-10-11) | in progress |

**Completion / progress**

Prepared themed signed-out landing, account-name menu, current profile and access-denied views. Serious accessibility checks and browser flows pass. Navigation for future role-specific feature pages and actual dev sign-in acceptance remain pending.

**Description**

Header with title/kicker per prototype, user name menu, nav items by role, signed-out landing, 'Access has not been granted' page for rejected sign-ins.

**Acceptance criteria**

- [ ] Nav shows only permitted items
- [ ] Access-denied page text matches US-02
- [ ] The page renders both a pre-sign-up rejection from the callback and a 403 from /me
- [ ] axe has no serious violations

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-12
**Role authority and token staleness: tests and runbook note**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | backend, security |
| Requirements | FR-AUTH-04 |
| Stories | US-44 |
| Is blocked by | S1-06 |
| Blocks | - |
| Status (2026-10-11) | not started |

**Description**

Verify that the users row decides admin and supervisor, and that cognito:groups claims cannot grant anything in S1, including stale tokens after a demotion. Record what is deferred: Cognito-side group assignment and global sign-out arrive with S5-05, so until then revocation is enforced by the database check on the next request.

**Acceptance criteria**

- [ ] Demoted admin with a still-valid token is refused on admin checks
- [ ] A token carrying the admin group for a user who is not an admin in the database grants nothing
- [ ] Test documents the behaviour
- [ ] Runbook note says revocation is database-enforced until S5-05

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-13
**E2E: invited sign-in and denied sign-in**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | e2e, adr-0011 |
| Requirements | FR-AUTH-01, FR-AUTH-06 |
| Stories | US-01, US-02 |
| Is blocked by | S1-11, S1-09, S1-03 |
| Blocks | S2-17 |
| Status (2026-10-11) | not started |

**Description**

Playwright against dev using the token strategy ADR-0011 settles: an invited user lands in the app with their name shown, an uninvited user sees the access-denied page, and sign-out works. Automating Google's consent screen is not reliable, so this ticket implements whichever route the ADR chose and, if that route is a recorded manual demo, it instead automates everything that does not need a Google identity.

**Acceptance criteria**

- [ ] Both paths pass in the dev smoke stage, or the ADR-0011 fallback is implemented and the manual demo is recorded
- [ ] No real credentials committed; test credentials come from Secrets Manager or SSM
- [ ] The suite does not drive accounts.google.com

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
