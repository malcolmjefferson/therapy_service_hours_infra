# S1: Secure sign-in

> **Milestone:** M2 · **Tickets:** 13 · **Estimate:** 19 developer-days

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

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S1-01](#s1-01) | Story | Cognito user pool, Google IdP, app client, hosted UI, Secrets Manager reference | 2 | S0-15, S1-02 |
| [S1-02](#s1-02) | Spike | Spike: invited-email binding for Google-only sign-in (OQ-01 decided) | 1 | S0-02 |
| [S1-03](#s1-03) | Story | PreSignUp Lambda enforcing the invitation allowlist | 1.5 | S1-01, S1-04 |
| [S1-04](#s1-04) | Story | Migration: organizations, users, invitations; seed Default Organization | 1.5 | S0-10 |
| [S1-05](#s1-05) | Task | OpenAPI: /me, security scheme, Problem responses | 1 | S0-19, S1-04 |
| [S1-06](#s1-06) | Story | Auth middleware: claims to actor, user lookup, sub binding, deactivated check | 2 | S1-04, S1-05, S0-09 |
| [S1-07](#s1-07) | Story | internal/authz policy framework | 1.5 | S1-06 |
| [S1-08](#s1-08) | Story | GET /me endpoint | 1 | S1-06, S1-07 |
| [S1-09](#s1-09) | Task | Seed script: first admin and Default Organization | 1 | S1-04, S1-01 |
| [S1-10](#s1-10) | Story | Frontend auth: Cognito hosted UI (code + PKCE), AuthProvider, route guards | 2 | S1-01, S1-08, S0-19 |
| [S1-11](#s1-11) | Story | App shell: header, role-aware nav, landing and access-denied pages | 1.5 | S1-10 |
| [S1-12](#s1-12) | Task | Group claims to role mirror: consistency and token refresh tests | 1 | S1-06 |
| [S1-13](#s1-13) | Task | E2E: invited sign-in and denied sign-in | 2 | S1-11, S1-09, S1-03 |

---

### S1-01
**Cognito user pool, Google IdP, app client, hosted UI, Secrets Manager reference**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, auth |
| Requirements | FR-AUTH-01, NFR-SEC-04 |
| Stories | US-01 |
| Is blocked by | S0-15, S1-02 |
| Blocks | S1-03, S1-09, S1-10, S5-04 |

**Description**

CDK auth construct: user pool with self sign-up disabled, groups admin and supervisor, Google identity provider with client secret from Secrets Manager (owner creates the Google OAuth client), app client with code+PKCE, hosted UI domain, callback URLs from the CloudFront domain.

**Acceptance criteria**

- [ ] Owner-provided Google OAuth client id/secret stored in Secrets Manager, not committed
- [ ] Callback/logout URLs match dev and prod CloudFront domains (ordering documented)
- [ ] Self sign-up disabled

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-02
**Spike: invited-email binding for Google-only sign-in (OQ-01 decided)**

| Field | Value |
|---|---|
| Issue Type | Spike |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | spike, auth |
| Requirements | FR-AUTH-01, FR-AUTH-03 |
| Stories | US-01 |
| Is blocked by | S0-02 |
| Blocks | S1-01, S5-05 |

**Description**

OQ-01 is decided: Google sign-in only, no email/password. Time-boxed to 1 day. Document how federated Google users bind to pre-created Cognito users, and the dev E2E test-user strategy.

**Acceptance criteria**

- [ ] Binding approach recorded in ADR-0002 notes
- [ ] Proof that an invited email binds to one Cognito identity without duplicates
- [ ] Test-user approach for Playwright agreed

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
| Labels | backend, auth, db |
| Requirements | FR-AUTH-01, FR-AUTH-05 |
| Stories | US-02 |
| Is blocked by | S1-01, S1-04 |
| Blocks | S1-13, S5-11 |

**Description**

VPC Lambda trigger connecting with a read-only IAM database role; rejects emails not in invitations or belonging to deactivated users; covers federated Google sign-ins.

**Acceptance criteria**

- [ ] Uninvited Google email is rejected with a stable error code
- [ ] Invited email passes
- [ ] Deactivated user rejected
- [ ] Lambda has no internet and no write rights

**Definition of Done**

- [ ] Implementation merged
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
| Labels | backend, db |
| Requirements | FR-AUTH-02, FR-AUTH-03 |
| Stories | US-46 |
| Is blocked by | S0-10 |
| Blocks | S1-03, S1-05, S1-06, S1-09, S2-01, S5-01, S6-01 |

**Description**

goose migration creating the tables per CLAUDE.md §9 with citext email uniqueness, NOT NULL organization, role mirror columns, status check; sqlc queries for lookup by email/sub.

**Acceptance criteria**

- [ ] Applies cleanly via migrate Lambda
- [ ] users.email unique case-insensitively
- [ ] Default Organization row created idempotently

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-05
**OpenAPI: /me, security scheme, Problem responses**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | api, adr-0006 |
| Requirements | FR-AUTH-04 |
| Stories | US-01 |
| Is blocked by | S0-19, S1-04 |
| Blocks | S1-06 |

**Description**

Spec the bearer JWT scheme, GET /me response (id, name, email, roles, organization), and standard 401/403/404 problem responses; regenerate server and frontend types.

**Acceptance criteria**

- [ ] Spectral clean
- [ ] Frontend drift gate passes
- [ ] Examples contain only fictional data

**Definition of Done**

- [ ] Implementation merged
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
| Labels | backend, auth, security |
| Requirements | FR-AUTH-03, FR-AUTH-04, FR-AUTH-05 |
| Stories | US-01, US-02 |
| Is blocked by | S1-04, S1-05, S0-09 |
| Blocks | S1-07, S1-08, S1-12 |

**Description**

Resolve the actor from JWT claims, load the user by email/sub, bind cognito_sub on first sign-in inside a transaction, refuse deactivated users, re-verify roles against the users row.

**Acceptance criteria**

- [ ] First sign-in binds sub once (concurrent first requests do not duplicate)
- [ ] Deactivated user gets 403 even with a valid token
- [ ] Role in token but not in DB is ignored

**Definition of Done**

- [ ] Implementation merged
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

**Description**

Central policy package: Actor type, role predicates, relationship checks interface (same org, supervisor-of), helper that handlers must call; lint/test that handlers reference authz.

**Acceptance criteria**

- [ ] Table-driven unit tests for policy functions
- [ ] Handler template demonstrates usage
- [ ] Documented contract for later slices

**Definition of Done**

- [ ] Implementation merged
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

**Description**

Returns the current user's profile, roles and organization via a dedicated DTO.

**Acceptance criteria**

- [ ] Returns 200 for active user
- [ ] 401 without token
- [ ] DTO contains explicit fields only

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-09
**Seed script: first admin and Default Organization**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S1 Secure sign-in |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, scripts |
| Requirements | FR-AUTH-02 |
| Stories | US-46 |
| Is blocked by | S1-04, S1-01 |
| Blocks | S1-13 |

**Description**

scripts/seed-first-admin: idempotent invocation of a seed Lambda/CLI that creates the invitation, user row (Admin) and organization; also supports adding test invitations in dev only.

**Acceptance criteria**

- [ ] Running twice changes nothing
- [ ] Prod seeding requires an explicit flag
- [ ] Dev helper cannot run against prod

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
| Is blocked by | S1-01, S1-08, S0-19 |
| Blocks | S1-11 |

**Description**

Redirect flow, token handling in memory with refresh, AuthProvider/useAuth, protected routes, 401 handling in the API client.

**Acceptance criteria**

- [ ] Sign-in and sign-out work end to end on dev
- [ ] Tokens are not stored in localStorage
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

**Description**

Header with title/kicker per prototype, user name menu, nav items by role, signed-out landing, 'Access has not been granted' page for rejected sign-ins.

**Acceptance criteria**

- [ ] Nav shows only permitted items
- [ ] Access-denied page text matches US-02
- [ ] axe has no serious violations

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S1-12
**Group claims to role mirror: consistency and token refresh tests**

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

**Description**

Verify cognito:groups claims versus users.is_admin/is_supervisor handling, including stale tokens after demotion (DB wins).

**Acceptance criteria**

- [ ] Demoted admin with a still-valid token is refused on admin checks
- [ ] Test documents behavior
- [ ] Runbook note added

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
| Labels | e2e |
| Requirements | FR-AUTH-01, FR-AUTH-06 |
| Stories | US-01, US-02 |
| Is blocked by | S1-11, S1-09, S1-03 |
| Blocks | S2-17 |

**Description**

Playwright against dev using the test-user strategy from S1-02: invited user lands in app with name shown; uninvited user sees the access-denied page; sign-out.

**Acceptance criteria**

- [ ] Both paths pass in the dev smoke stage
- [ ] No real credentials committed

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
