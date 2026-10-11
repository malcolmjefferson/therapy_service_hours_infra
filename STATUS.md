# Status: therapy_service_hours_infra

> Ticket status for this repo. Updated in the same PR that changes a ticket's state (CLAUDE.md §0.10).
> Tickets: `docs/jira/`. Other repos: [backend](https://github.com/malcolmjefferson/therapy_service_hours_backend/blob/main/STATUS.md), [frontend](https://github.com/malcolmjefferson/therapy_service_hours_frontend/blob/main/STATUS.md).

## Summary (2026-10-10)

- **Slice S0 (walking skeleton):** 14 done, 2 in review, 0 in progress, 0 not started (of 16 tickets touching this repo).
- **AWS:** account bootstrapped for CDK in us-west-2 (CDKToolkit). The dev data stack has not deployed successfully yet (four attempts; each failure fixed); nothing else is deployed.
- **Next:** deploy dev/Data, then the pipeline stack once and authorize its GitHub connection (owner), then S1 (auth and invites).

## Tickets

| ID | Title | Status | PRs | Notes |
|---|---|---|---|---|
| S0-01 | Create repos, branch protection and project scaffolding | done | [infra #1](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/1) | Branch protection turned on by the owner |
| S0-02 | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006 | done | [infra #4](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/4) | Also records public repos and GitHub Actions PR gates |
| S0-05 | CDK app skeleton, environment config and tagging | done | [infra #2](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/2) |  |
| S0-06 | Budget-guard synth assertion | done | [infra #3](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/3) |  |
| S0-07 | CDK network and database constructs | done | [infra #6](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/6) | Code merged; first dev deploy of the data stack pending (owner runs it) |
| S0-08 | Database role bootstrap custom resource (app_rw, migrator, rds_iam) | in review | [infra #7](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/7), [infra #11](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/11), fix: infra PR (this one) | Deploy 4 blocked by a log group the provider recreated during rollback; named Lambdas now deny themselves logs:CreateLogGroup. First successful dev deploy pending |
| S0-11 | CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs | done | [infra #12](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/12) | Synth-tested; reaches dev with the app-stack deploy |
| S0-12 | CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy | done | [infra #13](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/13) | Synth-tested; header and 404 checks run after the dev web-stack deploy |
| S0-14 | Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage | done | [infra #16](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/16) | Owner: deploy the pipeline stack once and authorize the GitHub connection |
| S0-15 | Pipeline: deploy dev (data, migrate, app, frontend) and smoke test | done | [infra #17](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/17) | Live once the pipeline is deployed and its connection authorized |
| S0-16 | Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications | in review | [infra #18](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/18), fix: infra PR (this one) | First pipeline deploy failed: CodeStar Notifications rejected the topic; notifications now go through EventBridge rules |
| S0-17 | CI security and quality gates | done | [infra #5](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/5) | Dependabot ignore rules for held-back majors: frontend #10, infra #9 (in review) |
| S0-18 | Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms | done | [infra #14](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/14) | Pipeline failure notifications come with S0-14; owner confirms the SNS email after deploy |
| S0-19 | OpenAPI pinned-copy sync and drift gate in frontend and pipeline | done | [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5) | Frontend part and the pipeline drift step (S0-14) merged |
| S0-20 | Minimal Playwright smoke and header scan against dev | done | [frontend #13](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/13), [infra #19](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/19) | Pipeline smoke runs smoke.sh, then the frontend's Playwright spec; merge frontend #13 before the pipeline's first run |
| S0-21 | Runbook v0 and README per repo | done | [infra #20](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/20), backend and frontend README PRs | `docs/runbook.md` here; restore steps marked (rehearse) until the S11 drill |

Statuses: **not started**, **in progress**, **in review** (PR open), **done** (merged to main).
