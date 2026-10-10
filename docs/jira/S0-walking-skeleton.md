# S0: Walking skeleton

> **Milestone:** M1 · **Tickets:** 21 · **Estimate:** 32 developer-days

## Slice goal
Prove the whole delivery path with the smallest possible feature: a page served by CloudFront calls the API, which reads the database, deployed to dev and prod by one pipeline.

## Demo / acceptance of the slice
Open the dev and prod URLs: the Status page shows the API version and database check. Break a lint rule, a test or a migration on purpose: the pipeline stops before prod and an email arrives.

## Slice Definition of Done
- [ ] Every ticket below meets its own AC and the DoD in `jira/README.md`
- [ ] OpenAPI changed first and the frontend drift gate is green
- [ ] Automated tests for the slice pass in the pipeline on dev
- [ ] The demo above is performed on dev by someone other than the author, or recorded
- [ ] Docs updated (this folder, OpenAPI, CLAUDE.md if contracts changed)

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by |
|---|---|---|--:|---|
| [S0-01](#s0-01) | Task | Create repos, branch protection and project scaffolding | 1 | - |
| [S0-02](#s0-02) | Task | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006 | 0.5 | S0-01 |
| [S0-03](#s0-03) | Story | Backend skeleton: Go module, chi router, /healthz, slog, request IDs | 1.5 | S0-01 |
| [S0-04](#s0-04) | Task | OpenAPI v0 with oapi-codegen, spectral and oasdiff in backend CI | 1.5 | S0-03 |
| [S0-05](#s0-05) | Task | CDK app skeleton, environment config and tagging | 1.5 | S0-01 |
| [S0-06](#s0-06) | Task | Budget-guard synth assertion | 1 | S0-05 |
| [S0-07](#s0-07) | Task | CDK network and database constructs | 2 | S0-05, S0-02 |
| [S0-08](#s0-08) | Task | Database role bootstrap custom resource (app_rw, migrator, rds_iam) | 2 | S0-07 |
| [S0-09](#s0-09) | Story | Backend DB package: pgx pool with IAM token refresh and TLS | 1.5 | S0-03 |
| [S0-10](#s0-10) | Story | Migrate Lambda with embedded goose and baseline migration | 2 | S0-09, S0-08 |
| [S0-11](#s0-11) | Task | CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs | 2 | S0-03, S0-07 |
| [S0-12](#s0-12) | Task | CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy | 2 | S0-11 |
| [S0-13](#s0-13) | Story | Frontend skeleton: Vite + TS, router, TanStack Query, theme, self-hosted fonts | 2 | S0-01, S0-04 |
| [S0-14](#s0-14) | Story | Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage | 2 | S0-05, S0-17 |
| [S0-15](#s0-15) | Story | Pipeline: deploy dev (data, migrate, app, frontend) and smoke test | 2 | S0-14, S0-10, S0-12, S0-13 |
| [S0-16](#s0-16) | Story | Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications | 1.5 | S0-15 |
| [S0-17](#s0-17) | Task | CI security and quality gates | 1.5 | S0-03, S0-13 |
| [S0-18](#s0-18) | Task | Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms | 1 | S0-11, S0-14 |
| [S0-19](#s0-19) | Task | OpenAPI pinned-copy sync and drift gate in frontend and pipeline | 1 | S0-04, S0-13, S0-14 |
| [S0-20](#s0-20) | Task | Minimal Playwright smoke and header scan against dev | 1.5 | S0-15 |
| [S0-21](#s0-21) | Task | Runbook v0 and README per repo | 1 | S0-16 |

---

### S0-01
**Create repos, branch protection and project scaffolding**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, owner-action |
| Requirements | NFR-SEC-05, NFR-DOC-01 |
| Stories | US-39 |
| Is blocked by | - |
| Blocks | S0-02, S0-03, S0-05, S0-13 |

**Description**

Owner creates the three public GitHub repos under malcolmjefferson; add CLAUDE.md, CODEOWNERS, PR template (Markdown headers/bullets), branch protection on main.

**Acceptance criteria**

- [ ] Three public repos exist with the exact names in CLAUDE.md §3
- [ ] main requires PR + passing checks
- [ ] CLAUDE.md and docs/ copied into each repo root
- [ ] No secrets or real names committed (secret-scan pre-commit hook added)

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-02
**Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 0.5 day(s) · 1 points |
| Labels | docs, decision |
| Requirements | NFR-DOC-01 |
| Stories | US-39 |
| Is blocked by | S0-01 |
| Blocks | S0-07, S1-02 |

**Description**

Owner accepted ADR-0001 to ADR-0006 and confirmed ASM-01..ASM-07 and OQ-02/OQ-03 on 2026-10-10 (recorded in the ADRs and spec Section 7). Update CLAUDE.md for the deviations listed in adr/README.md.

**Acceptance criteria**

- [ ] ADR statuses and spec Section 7 already record the owner decisions (no edits needed)
- [ ] CLAUDE.md diagram and tech table updated for the ADR deviations

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-03
**Backend skeleton: Go module, chi router, /healthz, slog, request IDs**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend |
| Requirements | NFR-OPS-01, NFR-SEC-05 |
| Stories | US-42 |
| Is blocked by | S0-01 |
| Blocks | S0-04, S0-09, S0-11, S0-17 |

**Description**

Create therapy_service_hours_backend layout (CLAUDE.md §3.1): config, structured JSON logging with request ID, panic recovery, body size limit, RFC 7807 error helper, Lambda adapter, GET /healthz.

**Acceptance criteria**

- [ ] GET /healthz returns 200 JSON with version
- [ ] Every log line is JSON with request_id
- [ ] Panic returns problem+json 500 and logs the stack
- [ ] Unit tests for middleware

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-04
**OpenAPI v0 with oapi-codegen, spectral and oasdiff in backend CI**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, api, adr-0006 |
| Requirements | NFR-DOC-01 |
| Stories | US-39 |
| Is blocked by | S0-03 |
| Blocks | S0-13, S0-19 |

**Description**

Author api/openapi.yaml (healthz, Problem schema, conventions for pagination and Idempotency-Key); generate server interface; add spectral ruleset and oasdiff breaking-change check.

**Acceptance criteria**

- [ ] healthz handler implements the generated interface
- [ ] CI fails if generated code is stale
- [ ] CI fails on a deliberately breaking spec change
- [ ] Spectral ruleset documented

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-05
**CDK app skeleton, environment config and tagging**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | infra |
| Requirements | NFR-OPS-04, NFR-COST-01 |
| Stories | US-39, US-42 |
| Is blocked by | S0-01 |
| Blocks | S0-06, S0-07, S0-14 |

**Description**

Create therapy_service_hours_infra: bin/, lib/, config/dev.ts and prod.ts (account, region us-west-2, retention, backup, deletion protection), mandatory tags app/env/owner.

**Acceptance criteria**

- [ ] cdk synth passes for dev and prod
- [ ] All resources carry app/env/owner tags (assertion test)
- [ ] Log retention 14d dev / 30d prod config values present

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-06
**Budget-guard synth assertion**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, cost |
| Requirements | NFR-COST-01 |
| Stories | US-41 |
| Is blocked by | S0-05 |
| Blocks | - |

**Description**

CDK Aspect/test that fails synth if a NAT Gateway, RDS Proxy, interface VPC endpoint, ALB/NLB, Multi-AZ DB, or customer-managed KMS key is declared.

**Acceptance criteria**

- [ ] A fixture stack with a NAT Gateway fails the assertion
- [ ] Real stacks pass
- [ ] Failure message names the rule and CLAUDE.md §0.6

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-07
**CDK network and database constructs**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, db, adr-0001 |
| Requirements | NFR-SEC-04, NFR-REL-01, NFR-COST-01 |
| Stories | US-39 |
| Is blocked by | S0-05, S0-02 |
| Blocks | S0-08, S0-11 |

**Description**

VPC with private-isolated subnets in two AZs and an S3 gateway endpoint (no NAT), security groups, single-AZ RDS PostgreSQL db.t4g.micro with encryption, IAM auth enabled, per-env backup retention and deletion protection.

**Acceptance criteria**

- [ ] Prod: deletion protection on, 7-day backups; dev: off, 1 day
- [ ] No 0.0.0.0/0 ingress
- [ ] DB not publicly accessible
- [ ] Master secret generated by RDS

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-08
**Database role bootstrap custom resource (app_rw, migrator, rds_iam)**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, db, adr-0001 |
| Requirements | NFR-SEC-01, NFR-SEC-04 |
| Stories | US-39 |
| Is blocked by | S0-07 |
| Blocks | S0-10 |

**Description**

Idempotent custom resource (Lambda in VPC) creates roles with GRANT rds_iam; app_rw has DML only, migrator has DDL on the app schema; resolves master secret via CloudFormation dynamic reference at deploy time.

**Acceptance criteria**

- [ ] Re-running the resource changes nothing
- [ ] app_rw cannot CREATE TABLE (verified in S11-03)
- [ ] No runtime Lambda calls Secrets Manager

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-09
**Backend DB package: pgx pool with IAM token refresh and TLS**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | backend, db, adr-0001 |
| Requirements | NFR-SEC-01, NFR-SEC-04 |
| Stories | US-39 |
| Is blocked by | S0-03 |
| Blocks | S0-10, S1-06 |

**Description**

internal/db: pgx pool (max 2 conns), BeforeConnect hook that signs a fresh IAM token, sslmode=verify-full with embedded RDS CA bundle, local password mode for tests, transaction helper.

**Acceptance criteria**

- [ ] Token refreshed on a new connection after expiry (injected clock test)
- [ ] Local mode works with Testcontainers
- [ ] Connection failures return a typed error

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-10
**Migrate Lambda with embedded goose and baseline migration**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | backend, db, adr-0003 |
| Requirements | NFR-OPS-02 |
| Stories | US-40 |
| Is blocked by | S0-09, S0-08 |
| Blocks | S0-15, S1-04 |

**Description**

cmd/migrate: embeds db/migrations, takes a Postgres advisory lock, runs goose as migrator role, returns a JSON result. Baseline migration enables citext and btree_gist. CI check rejects untagged DROP.

**Acceptance criteria**

- [ ] Second invocation is a no-op
- [ ] Two concurrent invocations: one waits on the lock
- [ ] Untagged DROP COLUMN fails CI
- [ ] Failure returns non-success payload

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-11
**CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, backend |
| Requirements | NFR-OPS-01, NFR-SEC-04, NFR-REL-01 |
| Stories | US-39, US-42 |
| Is blocked by | S0-03, S0-07 |
| Blocks | S0-12, S0-18 |

**Description**

Go Lambda (provided.al2023, arm64) in private subnets, reserved concurrency cap, HTTP API with default throttling and tighter limits on search routes, access logs, least-privilege role (rds-db:connect for app_rw only).

**Acceptance criteria**

- [ ] GET /api/v1/healthz returns 200 via API Gateway
- [ ] Reserved concurrency set (value documented against max_connections)
- [ ] IAM role has no wildcard resources

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-12
**CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, adr-0004 |
| Requirements | NFR-SEC-04, NFR-SEC-05 |
| Stories | US-39 |
| Is blocked by | S0-11 |
| Blocks | S0-15 |

**Description**

Private S3 bucket (Block Public Access, OAC), CloudFront with S3 default behavior and /api/* to API Gateway (no cache, Authorization forwarded), CloudFront Function for extensionless-path rewrite, response headers policy with CSP.

**Acceptance criteria**

- [ ] Deep link loads the SPA
- [ ] Unknown /api/v1/x returns problem+json 404, not index.html
- [ ] Headers: HSTS, nosniff, referrer-policy, frame deny, CSP present
- [ ] index.html no-cache; hashed assets immutable

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-13
**Frontend skeleton: Vite + TS, router, TanStack Query, theme, self-hosted fonts**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 2 day(s) · 5 points |
| Labels | frontend |
| Requirements | NFR-UX-01, NFR-A11Y-01 |
| Stories | US-39 |
| Is blocked by | S0-01, S0-04 |
| Blocks | S0-15, S0-17, S0-19, S2-10 |

**Description**

Create therapy_service_hours_frontend: Vite React TS, React Router, TanStack Query, theme tokens (CLAUDE.md §12.2), Fredoka and Inter self-hosted, eslint/tsc/vitest/RTL/MSW setup, a Status page calling /api/v1/healthz.

**Acceptance criteria**

- [ ] npm run build produces dist/
- [ ] Status page shows API version from healthz
- [ ] Fonts load from own origin (CSP passes)
- [ ] Lint, tsc and unit tests run in CI

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-14
**Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, pipeline, adr-0005 |
| Requirements | NFR-OPS-02 |
| Stories | US-39 |
| Is blocked by | S0-05, S0-17 |
| Blocks | S0-15, S0-18, S0-19 |

**Description**

CDK Pipelines in infra repo with sources from all three repos, queued execution, parallel build/test (backend, frontend, infra synth) and artifact output (Lambda zips, dist/).

**Acceptance criteria**

- [ ] Merge to any repo main triggers one run showing all three SHAs
- [ ] Failing lint/test stops the run and alerts
- [ ] Pipeline self-mutates from infra repo
- [ ] Cost of CodePipeline V2/CodeBuild estimated and recorded

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-15
**Pipeline: deploy dev (data, migrate, app, frontend) and smoke test**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 2 day(s) · 5 points |
| Labels | infra, pipeline, adr-0003 |
| Requirements | NFR-OPS-02 |
| Stories | US-39, US-40 |
| Is blocked by | S0-14, S0-10, S0-12, S0-13 |
| Blocks | S0-16, S0-20, S1-01 |

**Description**

Dev stage deploys data stack, invokes migrate Lambda from non-VPC CodeBuild, deploys app stack, syncs frontend to S3 and invalidates index.html, runs smoke (healthz + status page).

**Acceptance criteria**

- [ ] Broken migration stops the run before app stack deploy
- [ ] Smoke failure blocks approval stage
- [ ] Dev URL serves the Status page

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-16
**Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications**

| Field | Value |
|---|---|
| Issue Type | Story |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Highest |
| Estimate | 1.5 day(s) · 3 points |
| Labels | infra, pipeline, adr-0005 |
| Requirements | NFR-OPS-02, NFR-OPS-03 |
| Stories | US-39, US-40 |
| Is blocked by | S0-15 |
| Blocks | S0-21 |

**Description**

Approval stage shows the three commit SHAs and sends SNS; on approval takes an RDS snapshot, deploys the same artifacts to prod in the same order.

**Acceptance criteria**

- [ ] Prod deploy uses the artifact digests tested in dev
- [ ] Reject path leaves prod untouched
- [ ] Approval restricted to owner IAM principal
- [ ] Snapshot exists before prod migration

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-17
**CI security and quality gates**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | ci, security |
| Requirements | NFR-SEC-01, NFR-SEC-05 |
| Stories | US-43 |
| Is blocked by | S0-03, S0-13 |
| Blocks | S0-14 |

**Description**

golangci-lint, gosec (G201/G202), govulncheck, Semgrep rule forbidding string-built SQL in query calls, sqlc-current check, eslint, tsc, npm audit, Dependabot config in all repos.

**Acceptance criteria**

- [ ] Seeded string-built SQL snippet fails the Semgrep rule
- [ ] All gates run in the build stage and fail fast
- [ ] Dependabot PRs enabled

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-18
**Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | infra, ops |
| Requirements | NFR-OPS-03, NFR-OPS-01, NFR-COST-01 |
| Stories | US-41, US-42 |
| Is blocked by | S0-11, S0-14 |
| Blocks | - |

**Description**

SNS topic subscribed to owner email, AWS Budget at $50/month with 80% and 100% alerts, alarms for Lambda errors/throttles and API Gateway 5xx, pipeline failure notifications.

**Acceptance criteria**

- [ ] Owner confirms SNS subscription once
- [ ] Test alarm delivers an email
- [ ] Budget alerts configured
- [ ] Alarm thresholds documented

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-19
**OpenAPI pinned-copy sync and drift gate in frontend and pipeline**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1 day(s) · 2 points |
| Labels | frontend, api, adr-0006 |
| Requirements | NFR-DOC-01 |
| Stories | US-39 |
| Is blocked by | S0-04, S0-13, S0-14 |
| Blocks | S1-05, S1-10 |

**Description**

Pipeline build copies backend spec at the released commit into frontend, runs openapi-typescript, fails if the committed pinned copy differs; npm run api:sync for local use; typed openapi-fetch client wired to Status page.

**Acceptance criteria**

- [ ] Changing the backend spec without syncing fails the build
- [ ] Typed client compile error if an endpoint is removed
- [ ] Pinned copy records backend SHA

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-20
**Minimal Playwright smoke and header scan against dev**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | High |
| Estimate | 1.5 day(s) · 3 points |
| Labels | e2e, ci, adr-0004 |
| Requirements | NFR-SEC-05, NFR-OPS-02 |
| Stories | US-39 |
| Is blocked by | S0-15 |
| Blocks | - |

**Description**

Playwright test: deep link loads SPA, /api/v1/healthz returns JSON, unknown API path returns problem+json; header scan asserts security headers.

**Acceptance criteria**

- [ ] Test runs in the dev smoke stage
- [ ] Failure blocks approval
- [ ] Headers asserted by name and value

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed

---

### S0-21
**Runbook v0 and README per repo**

| Field | Value |
|---|---|
| Issue Type | Task |
| Epic | EPIC-S0 Walking skeleton |
| Priority | Medium |
| Estimate | 1 day(s) · 2 points |
| Labels | docs |
| Requirements | NFR-DOC-01 |
| Stories | US-39 |
| Is blocked by | S0-16 |
| Blocks | - |

**Description**

Document local setup, deploy flow, approvals, how to read alarms, how to restore, how to add a migration (expand/contract), and the budget guard.

**Acceptance criteria**

- [ ] A new developer can run backend tests and frontend dev server from README
- [ ] Runbook lists first-response steps for pipeline failure

**Definition of Done**

- [ ] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
