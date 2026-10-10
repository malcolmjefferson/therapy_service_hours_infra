# ADR-0005: One infra-owned pipeline for three repositories

- **Status:** Accepted · **Date:** 2026-10-09 (accepted 2026-10-10) · **Deciders:** project owner
- **Related:** NFR-OPS-02, NFR-OPS-03, CLAUDE.md §13 · Tickets: S0-14, S0-15, S0-16, S0-18

## Context

Three repositories (frontend, backend, infra) must be released together because the SPA and API share a contract. Separate pipelines risk shipping a frontend that expects an API that is not live yet.

## Decision

- **One AWS CDK Pipelines** pipeline (CodePipeline V2 + CodeBuild) is owned by the **infra** repo.
- It has **three GitHub sources** through CodeConnections (frontend `main`, backend `main`, infra `main`). A merge to any of them starts a run.
- Stages: **Source → Build and test (parallel: backend, frontend, infra synth) → Deploy dev (data stack → migrate → app stack → frontend sync) → Smoke → Manual approval → Deploy prod (same order)**.
- **Queued execution mode** so approvals do not race: a newer run waits and does not supersede a pending approval. The approval step shows the commit SHAs of all three repos.
- The same **built artifacts** (Lambda zips, frontend `dist/`) deployed to dev are promoted to prod; prod is not rebuilt.
- The pipeline **self-mutates** (CDK Pipelines default) from the infra repo.
- **SNS** topic for failures and approval requests, subscribed to the owner email (one-time confirmation).
- Build reports and `gosec`, `govulncheck`, `golangci-lint`, `eslint`, `tsc`, tests, `oasdiff`, and `cdk synth` (with the budget-guard assertion) run in the build stage and fail fast.

## Alternatives considered

| Option | Why not |
|---|---|
| Pipeline per repo | Version skew between SPA and API; harder approvals. |
| GitHub Actions + OIDC | Reasonable, but the owner chose AWS CodePipeline. Revisit if pipeline cost or speed becomes a problem. |
| Monorepo | Owner chose three repos. |

## Consequences

**Positive:** coherent releases, a single approval, clear audit trail.
**Negative:** infra repo has wider read access to the others; a flaky build in one repo blocks all releases; CodeConnections needs a one-time manual authorization.
**Cost:** CodePipeline V2 and CodeBuild small instances: within a few dollars per month at this volume (verify in the pricing calculator at S0-14).

## Validation

- Dry run: a docs-only commit in each repo triggers one run with the expected three SHAs.
- Failure drills: failing lint, failing test, failing smoke each stop the run before the approval stage and send an alert.
- Approval drill: reject, then approve; prod deploys exactly the artifact tested in dev (digest match).

## Open items

- Who may approve prod (default: owner only; IAM-restricted).
