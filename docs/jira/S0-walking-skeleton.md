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

## Execution status (2026-10-13)

**21 done** · **0 in progress** · **0 in review** · **0 not started**

All 21 implementation tickets are merged. Dev delivery is verified by successful pipeline executions, including release `7c97ec40-371c-4387-8c26-817c75450d4c` (data, migration, app, web, frontend sync and smoke). The owner deferred production deployment to M3; production execution, the recorded/manual failure-injection demo and SNS email receipt are not claimed by this update.

**Status legend:** done = merged implementation; in progress = partial implementation or remaining acceptance; in review = open PR; not started = implementation has not begun. Completion notes distinguish dev verification from deferred prod/manual acceptance. Acceptance checkboxes are not automatically checked from merge status.

## Ticket index

| ID | Type | Summary | Est (d) | Blocked by | Status |
|---|---|---|--:|---|---|
| [S0-01](#s0-01) | Task | Create repos, branch protection and project scaffolding | 1 | - | done |
| [S0-02](#s0-02) | Task | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006 | 0.5 | S0-01 | done |
| [S0-03](#s0-03) | Story | Backend skeleton: Go module, chi router, /healthz, slog, request IDs | 1.5 | S0-01 | done |
| [S0-04](#s0-04) | Task | OpenAPI v0 with oapi-codegen, spectral and oasdiff in backend CI | 1.5 | S0-03 | done |
| [S0-05](#s0-05) | Task | CDK app skeleton, environment config and tagging | 1.5 | S0-01 | done |
| [S0-06](#s0-06) | Task | Budget-guard synth assertion | 1 | S0-05 | done |
| [S0-07](#s0-07) | Task | CDK network and database constructs | 2 | S0-05, S0-02 | done |
| [S0-08](#s0-08) | Task | Database role bootstrap custom resource (app_rw, migrator, rds_iam) | 2 | S0-07 | done |
| [S0-09](#s0-09) | Story | Backend DB package: pgx pool with IAM token refresh and TLS | 1.5 | S0-03 | done |
| [S0-10](#s0-10) | Story | Migrate Lambda with embedded goose and baseline migration | 2 | S0-09, S0-08 | done |
| [S0-11](#s0-11) | Task | CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs | 2 | S0-03, S0-07 | done |
| [S0-12](#s0-12) | Task | CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy | 2 | S0-11 | done |
| [S0-13](#s0-13) | Story | Frontend skeleton: Vite + TS, router, TanStack Query, theme, self-hosted fonts | 2 | S0-01, S0-04 | done |
| [S0-14](#s0-14) | Story | Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage | 2 | S0-05, S0-17 | done |
| [S0-15](#s0-15) | Story | Pipeline: deploy dev (data, migrate, app, frontend) and smoke test | 2 | S0-14, S0-10, S0-12, S0-13 | done |
| [S0-16](#s0-16) | Story | Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications | 1.5 | S0-15 | done |
| [S0-17](#s0-17) | Task | CI security and quality gates | 1.5 | S0-03, S0-13 | done |
| [S0-18](#s0-18) | Task | Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms | 1 | S0-11, S0-14 | done |
| [S0-19](#s0-19) | Task | OpenAPI pinned-copy sync and drift gate in frontend and pipeline | 1 | S0-04, S0-13, S0-14 | done |
| [S0-20](#s0-20) | Task | Minimal Playwright smoke and header scan against dev | 1.5 | S0-15 | done |
| [S0-21](#s0-21) | Task | Runbook v0 and README per repo | 1 | S0-16 | done |

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
| Status (2026-10-13) | done |

**Completion / progress**

Three public repositories, scaffolding and owner-enabled branch protection are complete. Public repository visibility is the accepted owner decision.

Merged PRs: [backend #1](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/1), [frontend #1](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/1), [infra #1](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/1).

**Description**

Owner creates the three public GitHub repos under malcolmjefferson; add CLAUDE.md, CODEOWNERS, PR template (Markdown headers/bullets), branch protection on main.

**Acceptance criteria**

- [ ] Three public repos exist with the exact names in CLAUDE.md §3
- [ ] main requires PR + passing checks
- [ ] CLAUDE.md and docs/ copied into each repo root
- [ ] No secrets or real names committed (secret-scan pre-commit hook added)

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Accepted ADR-0001–0006 and owner decisions are reflected in the shared specification.

Merged PRs: [backend #6](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/6), [frontend #3](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/3), [infra #4](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/4).

**Description**

Owner accepted ADR-0001 to ADR-0006 and confirmed ASM-01..ASM-07 and OQ-02/OQ-03 on 2026-10-10 (recorded in the ADRs and spec Section 7). Update CLAUDE.md for the deviations listed in adr/README.md.

**Acceptance criteria**

- [ ] ADR statuses and spec Section 7 already record the owner decisions (no edits needed)
- [ ] CLAUDE.md diagram and tech table updated for the ADR deviations

**Definition of Done**

- [x] Implementation merged
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
| Blocks | S0-04, S0-09, S0-11, S0-17, S1-15 |
| Status (2026-10-13) | done |

**Completion / progress**

Go API skeleton and health endpoint are merged and released to dev.

Merged PRs: [backend #2](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/2).

**Description**

Create therapy_service_hours_backend layout (CLAUDE.md §3.1): config, structured JSON logging with request ID, panic recovery, body size limit, RFC 7807 error helper, Lambda adapter, GET /healthz.

**Acceptance criteria**

- [ ] GET /healthz returns 200 JSON with version
- [ ] Every log line is JSON with request_id
- [ ] Panic returns problem+json 500 and logs the stack
- [ ] Unit tests for middleware

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

OpenAPI server generation, lint and breaking-change gates are merged.

Merged PRs: [backend #3](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/3).

**Description**

Author api/openapi.yaml (healthz, Problem schema, conventions for pagination and Idempotency-Key); generate server interface; add spectral ruleset and oasdiff breaking-change check.

**Acceptance criteria**

- [ ] healthz handler implements the generated interface
- [ ] CI fails if generated code is stale
- [ ] CI fails on a deliberately breaking spec change
- [ ] Spectral ruleset documented

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

CDK stacks, typed environment configuration and tagging assertions are merged.

Merged PRs: [infra #2](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/2).

**Description**

Create therapy_service_hours_infra: bin/, lib/, config/dev.ts and prod.ts (account, region us-west-2, retention, backup, deletion protection), mandatory tags app/env/owner.

**Acceptance criteria**

- [ ] cdk synth passes for dev and prod
- [ ] All resources carry app/env/owner tags (assertion test)
- [ ] Log retention 14d dev / 30d prod config values present

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Budget guard assertions are merged and pass during synthesis.

Merged PRs: [infra #3](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/3).

**Description**

CDK Aspect/test that fails synth if a NAT Gateway, RDS Proxy, interface VPC endpoint, ALB/NLB, Multi-AZ DB, or customer-managed KMS key is declared.

**Acceptance criteria**

- [ ] A fixture stack with a NAT Gateway fails the assertion
- [ ] Real stacks pass
- [ ] Failure message names the rule and CLAUDE.md §0.6

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Private dev network and IAM-enabled RDS are deployed. PostgreSQL minor upgrades are pinned; prod deployment is deferred to M3.

Merged PRs: [infra #6](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/6), [infra #24](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/24).

**Description**

VPC with private-isolated subnets in two AZs and an S3 gateway endpoint (no NAT), security groups, single-AZ RDS PostgreSQL db.t4g.micro with encryption, IAM auth enabled, per-env backup retention and deletion protection.

**Acceptance criteria**

- [ ] Prod: deletion protection on, 7-day backups; dev: off, 1 day
- [ ] No 0.0.0.0/0 ingress
- [ ] DB not publicly accessible
- [ ] Master secret generated by RDS

**Definition of Done**

- [x] Implementation merged
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
| Blocks | S0-10, S1-17 |
| Status (2026-10-13) | done |

**Completion / progress**

Role bootstrap provider and worker are deployed and idempotent. Deployment-time credential handling and non-superuser/log-group fixes are merged.

Merged PRs: [backend #8](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/8), [backend #10](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/10), [backend #11](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/11), [backend #13](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/13), [infra #7](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/7), [infra #11](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/11), [infra #21](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/21).

**Description**

Idempotent custom resource (Lambda in VPC) creates roles with GRANT rds_iam; app_rw has DML only, migrator has DDL on the app schema; resolves master secret via CloudFormation dynamic reference at deploy time.

**Acceptance criteria**

- [ ] Re-running the resource changes nothing
- [ ] app_rw cannot CREATE TABLE (verified in S11-03)
- [ ] No runtime Lambda calls Secrets Manager

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

pgx pooling, IAM token refresh and verified TLS are released; first-connect timeout correction is merged.

Merged PRs: [backend #4](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/4), [backend #15](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/15).

**Description**

internal/db: pgx pool (max 2 conns), BeforeConnect hook that signs a fresh IAM token, sslmode=verify-full with embedded RDS CA bundle, local password mode for tests, transaction helper.

**Acceptance criteria**

- [ ] Token refreshed on a new connection after expiry (injected clock test)
- [ ] Local mode works with Testcontainers
- [ ] Connection failures return a typed error

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Embedded goose migration Lambda is deployed and successful in dev releases; first-connection retry is merged.

Merged PRs: [backend #7](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/7), [backend #15](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/15).

**Description**

cmd/migrate: embeds db/migrations, takes a Postgres advisory lock, runs goose as migrator role, returns a JSON result. Baseline migration enables citext and btree_gist. CI check rejects untagged DROP.

**Acceptance criteria**

- [ ] Second invocation is a no-op
- [ ] Two concurrent invocations: one waits on the lock
- [ ] Untagged DROP COLUMN fails CI
- [ ] Failure returns non-success payload

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

HTTP API and Go API Lambda are deployed to dev. Cognito route protection is later S1-14 work.

Merged PRs: [infra #12](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/12).

**Description**

Go Lambda (provided.al2023, arm64) in private subnets, reserved concurrency cap, HTTP API with default throttling and tighter limits on search routes, access logs, least-privilege role (rds-db:connect for app_rw only).

**Acceptance criteria**

- [ ] GET /api/v1/healthz returns 200 via API Gateway
- [ ] Reserved concurrency set (value documented against max_connections)
- [ ] IAM role has no wildcard resources

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

S3/OAC, CloudFront API routing, SPA rewrite and response headers are deployed and smoke-tested on dev.

Merged PRs: [infra #13](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/13).

**Description**

Private S3 bucket (Block Public Access, OAC), CloudFront with S3 default behavior and /api/* to API Gateway (no cache, Authorization forwarded), CloudFront Function for extensionless-path rewrite, response headers policy with CSP.

**Acceptance criteria**

- [ ] Deep link loads the SPA
- [ ] Unknown /api/v1/x returns problem+json 404, not index.html
- [ ] Headers: HSTS, nosniff, referrer-policy, frame deny, CSP present
- [ ] index.html no-cache; hashed assets immutable

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

React/Vite skeleton, routing, query provider, theme and Status page are merged and served by the dev release.

Merged PRs: [frontend #2](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/2).

**Description**

Create therapy_service_hours_frontend: Vite React TS, React Router, TanStack Query, theme tokens (CLAUDE.md §12.2), Fredoka and Inter self-hosted, eslint/tsc/vitest/RTL/MSW setup, a Status page calling /api/v1/healthz.

**Acceptance criteria**

- [ ] npm run build produces dist/
- [ ] Status page shows API version from healthz
- [ ] Fonts load from own origin (CSP passes)
- [ ] Lint, tsc and unit tests run in CI

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

The three-source pipeline builds and releases merged commits. Push-trigger repair is complete.

Merged PRs: [infra #16](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/16), [infra #26](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/26).

**Description**

CDK Pipelines in infra repo with sources from all three repos, queued execution, parallel build/test (backend, frontend, infra synth) and artifact output (Lambda zips, dist/).

**Acceptance criteria**

- [ ] Merge to any repo main triggers one run showing all three SHAs
- [ ] Failing lint/test stops the run and alerts
- [ ] Pipeline self-mutates from infra repo
- [ ] Cost of CodePipeline V2/CodeBuild estimated and recorded

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Dev data → migration → app → web → frontend sync → smoke completed successfully. Concurrency preflight is deployed.

Merged PRs: [infra #17](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/17), [infra #27](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/27).

**Description**

Dev stage deploys data stack, invokes migrate Lambda from non-VPC CodeBuild, deploys app stack, syncs frontend to S3 and invalidates index.html, runs smoke (healthz + status page).

**Acceptance criteria**

- [ ] Broken migration stops the run before app stack deploy
- [ ] Smoke failure blocks approval stage
- [ ] Dev URL serves the Status page

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Approval, snapshot, promotion and notification implementation is merged and tested. RELEASE.deployProd stays false by owner decision until M3; no live prod promotion or snapshot drill is claimed.

Merged PRs: [infra #18](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/18), [infra #23](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/23), [infra #27](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/27), [infra #28](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/28).

**Description**

Approval stage shows the three commit SHAs and sends SNS; on approval takes an RDS snapshot, deploys the same artifacts to prod in the same order.

**Acceptance criteria**

- [ ] Prod deploy uses the artifact digests tested in dev
- [ ] Reject path leaves prod untouched
- [ ] Approval restricted to owner IAM principal
- [ ] Snapshot exists before prod migration

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Repository quality/security gates and Dependabot are merged. npm audit runs on PRs and weekly rather than blocking release builds.

Merged PRs: [backend #5](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/5), [frontend #4](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/4), [frontend #10](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/10), [frontend #16](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/16), [infra #5](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/5), [infra #9](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/9), [infra #25](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/25).

**Description**

golangci-lint, gosec (G201/G202), govulncheck, Semgrep rule forbidding string-built SQL in query calls, sqlc-current check, eslint, tsc, npm audit, Dependabot config in all repos.

**Acceptance criteria**

- [ ] Seeded string-built SQL snippet fails the Semgrep rule
- [ ] All gates run in the build stage and fail fast
- [ ] Dependabot PRs enabled

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Alerts and the $50 account budget are deployed; the budget is owned by the active pipeline stack. Owner SNS subscription confirmation and email receipt are not independently verified here.

Merged PRs: [infra #14](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/14), [infra #28](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/28).

**Description**

SNS topic subscribed to owner email, AWS Budget at $50/month with 80% and 100% alerts, alarms for Lambda errors/throttles and API Gateway 5xx, pipeline failure notifications.

**Acceptance criteria**

- [ ] Owner confirms SNS subscription once
- [ ] Test alarm delivers an email
- [ ] Budget alerts configured
- [ ] Alarm thresholds documented

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Pinned OpenAPI sync and drift gates are merged and pass in successful releases.

Merged PRs: [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5), [infra #16](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/16).

**Description**

Pipeline build copies backend spec at the released commit into frontend, runs openapi-typescript, fails if the committed pinned copy differs; npm run api:sync for local use; typed openapi-fetch client wired to Status page.

**Acceptance criteria**

- [ ] Changing the backend spec without syncing fails the build
- [ ] Typed client compile error if an endpoint is removed
- [ ] Pinned copy records backend SHA

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Playwright smoke and header scan are merged and pass in the dev pipeline.

Merged PRs: [frontend #13](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/13), [infra #19](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/19).

**Description**

Playwright test: deep link loads SPA, /api/v1/healthz returns JSON, unknown API path returns problem+json; header scan asserts security headers.

**Acceptance criteria**

- [ ] Test runs in the dev smoke stage
- [ ] Failure blocks approval
- [ ] Headers asserted by name and value

**Definition of Done**

- [x] Implementation merged
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
| Status (2026-10-13) | done |

**Completion / progress**

Repository quick-start documentation and infra runbook are merged. Restore rehearsals remain later hardening work.

Merged PRs: [backend #12](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/12), [frontend #14](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/14), [infra #20](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/20).

**Description**

Document local setup, deploy flow, approvals, how to read alarms, how to restore, how to add a migration (expand/contract), and the budget guard.

**Acceptance criteria**

- [ ] A new developer can run backend tests and frontend dev server from README
- [ ] Runbook lists first-response steps for pipeline failure

**Definition of Done**

- [x] Implementation merged
- [ ] Validation: automated tests (and manual steps where noted) pass
- [ ] Documentation: reviewer verification steps in the PR; OpenAPI/CLAUDE.md updated if a contract changed
