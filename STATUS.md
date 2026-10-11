# Status: therapy_service_hours_infra

> Ticket status for this repo. Updated in the same PR that changes a ticket's state (CLAUDE.md §0.10).
> Tickets: `docs/jira/`. Other repos: [backend](https://github.com/malcolmjefferson/therapy_service_hours_backend/blob/main/STATUS.md), [frontend](https://github.com/malcolmjefferson/therapy_service_hours_frontend/blob/main/STATUS.md).

## Summary (2026-10-10)

- **Slice S0 (walking skeleton):** 16 done, 0 in review, 0 in progress, 0 not started (of 16 tickets touching this repo).
- **AWS:** dev data stack deployed 2026-10-10; pipeline stack deployed 2026-10-11 (GitHub connection awaiting the owner's authorization). The dev app and web stacks and all of prod come with the first pipeline run.
- **Next:** owner authorizes the GitHub connection and starts the first pipeline run (dev, then prod after approval). Then S1 (auth and invites).

## Tickets

| ID | Title | Status | PRs | Notes |
|---|---|---|---|---|
| S0-01 | Create repos, branch protection and project scaffolding | done | [infra #1](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/1) | Branch protection turned on by the owner |
| S0-02 | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006 | done | [infra #4](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/4) | Also records public repos and GitHub Actions PR gates |
| S0-05 | CDK app skeleton, environment config and tagging | done | [infra #2](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/2) |  |
| S0-06 | Budget-guard synth assertion | done | [infra #3](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/3) |  |
| S0-07 | CDK network and database constructs | done | [infra #6](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/6), fix: infra PR (this one) | Deployed to dev 2026-10-10: RDS PostgreSQL 17.9, encrypted, private, IAM auth, TLS forced, 1-day backups; no NAT or internet gateway. Automatic minor upgrades off (the template pins the minor version) |
| S0-08 | Database role bootstrap custom resource (app_rw, migrator, rds_iam) | done | [infra #7](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/7), [infra #11](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/11), [infra #21](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/21) | Deployed to dev 2026-10-10 after four fixes (ADR-0001 amendment, provider timeout margin, non-superuser default privileges, log-group Deny); no password in any log |
| S0-11 | CDK api construct: API Gateway HTTP API, api Lambda, throttling, logs | done | [infra #12](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/12) | Synth-tested; reaches dev with the app-stack deploy |
| S0-12 | CDK web construct: S3 + OAC, CloudFront, /api/* behavior, SPA rewrite, headers policy | done | [infra #13](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/13) | Synth-tested; header and 404 checks run after the dev web-stack deploy |
| S0-14 | Pipeline stack: CDK Pipelines, three CodeConnections sources, build stage | done | [infra #16](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/16), infra PR (this one) | Merges did not start runs (pipeline created while the connection was PENDING); one-time fix: scripts/reregister-push-triggers.sh (owner) |
| S0-15 | Pipeline: deploy dev (data, migrate, app, frontend) and smoke test | done | [infra #17](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/17), [infra #27](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/27) | Concurrency preflight before each data stack (first dev run failed at the app stack: account Lambda quota 10) |
| S0-16 | Pipeline: manual approval, pre-prod snapshot, deploy prod, SNS notifications | done | [infra #18](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/18), [infra #23](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/23) | Pipeline stack deployed 2026-10-11; notifications through EventBridge rules (CodeStar Notifications rejected the topic). Owner decision 2026-10-11 ("Keep as is"): the prod approval stays inside the queued run (ADR-0005); while it waits, later runs queue, and an unanswered approval expires after 7 days |
| S0-17 | CI security and quality gates | done | [infra #5](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/5) | Dependabot ignore rules for held-back majors: frontend #10, infra #9 (in review) |
| S0-18 | Alerts and budget: SNS email, $50 AWS Budget, CloudWatch alarms | done | [infra #14](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/14) | Pipeline failure notifications come with S0-14; owner confirms the SNS email after deploy |
| S0-19 | OpenAPI pinned-copy sync and drift gate in frontend and pipeline | done | [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5) | Frontend part and the pipeline drift step (S0-14) merged |
| S0-20 | Minimal Playwright smoke and header scan against dev | done | [frontend #13](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/13), [infra #19](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/19) | Pipeline smoke runs smoke.sh, then the frontend's Playwright spec; merge frontend #13 before the pipeline's first run |
| S0-21 | Runbook v0 and README per repo | done | [infra #20](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/20), backend and frontend README PRs | `docs/runbook.md` here; restore steps marked (rehearse) until the S11 drill |

Statuses: **not started**, **in progress**, **in review** (PR open), **done** (merged to main).
