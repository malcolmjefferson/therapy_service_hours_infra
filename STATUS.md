# Status: therapy_service_hours_infra

> Ticket status for this repo. Updated in the same PR that changes a ticket's state (CLAUDE.md §0.10).
> Tickets: `docs/jira/`. Other repos: [backend](https://github.com/malcolmjefferson/therapy_service_hours_backend/blob/main/STATUS.md), [frontend](https://github.com/malcolmjefferson/therapy_service_hours_frontend/blob/main/STATUS.md).

## Summary (2026-10-10)

- **Slice S0 (walking skeleton):** 7 done, 0 in review, 1 in progress, 8 not started (of 16 tickets touching this repo).
- **AWS:** account bootstrapped for CDK in us-west-2 (CDKToolkit). First dev deploy of the data stack (VPC, RDS, database roles) is pending; nothing else is deployed.
- **Next:** S0-11 (API) and S0-12 (web) constructs, then the pipeline (S0-14 to S0-16) and alerts and budget (S0-18).

## Tickets

| ID | Title | Status | PRs | Notes |
|---|---|---|---|---|
| S0-01 | Create repos, branch protection and project scaffolding | done | [infra #1](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/1) | Branch protection turned on by the owner |
| S0-02 | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006 | done | [infra #4](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/4) | Also records public repos and GitHub Actions PR gates |
| S0-05 | CDK app skeleton, environment config and tagging | done | [infra #2](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/2) |  |
| S0-06 | Budget-guard synth assertion | done | [infra #3](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/3) |  |
| S0-07 | CDK network and database constructs | done | [infra #6](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/6) | Code merged; first dev deploy of the data stack pending (owner runs it) |
| S0-08 | Database role bootstrap custom resource (app_rw, migrator, rds_iam) | done | [infra #7](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/7) | Runs with the dev data-stack deploy |
| S0-11 | CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs | in review | infra PR (this one) | Synth-tested; reaches dev with the app-stack deploy |
| S0-12 | CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy | in review | infra PR (this one) | Synth-tested; header and 404 checks run after the dev web-stack deploy |
| S0-14 | Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage | not started | - | Owner authorizes CodeConnections in the console |
| S0-15 | Pipeline: deploy dev (data, migrate, app, frontend) and smoke test | not started | - |  |
| S0-16 | Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications | not started | - |  |
| S0-17 | CI security and quality gates | done | [infra #5](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/5) | Dependabot ignore rules for held-back majors: frontend #10, infra #9 (in review) |
| S0-18 | Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms | in review | infra PR (this one) | Pipeline failure notifications come with S0-14; owner confirms the SNS email after deploy |
| S0-19 | OpenAPI pinned-copy sync and drift gate in frontend and pipeline | in progress | [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5) | Frontend part merged; the pipeline drift step comes with S0-14 |
| S0-20 | Minimal Playwright smoke and header scan against dev | not started | - |  |
| S0-21 | Runbook v0 and README per repo | not started | - |  |

Statuses: **not started**, **in progress**, **in review** (PR open), **done** (merged to main).
