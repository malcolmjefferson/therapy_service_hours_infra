# therapy_service_hours_infra

AWS CDK (TypeScript) app: the stacks, the single release pipeline for all three repos, and environment config. Part of the **Therapy Service Hours Tracker** (see [CLAUDE.md](CLAUDE.md)).

## Start here

- **Specification and working agreements:** [CLAUDE.md](CLAUDE.md)
- **Engineering standards** (rules block merges): [docs/standards/](docs/standards/README.md)
- **Decisions:** [docs/adr/](docs/adr/README.md)
- **Backlog:** [docs/jira/](docs/jira/README.md)

## First-time setup

1. Install [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning, SEC-61).
2. Turn on the repo's git hooks once per clone:

   ```bash
   git config core.hooksPath .githooks
   ```

   The pre-commit hook scans staged changes for secrets and **blocks the commit** if gitleaks is missing.

## Commands

Requires Node 22 or later.

| Command | What it does |
|---|---|
| `npm ci` | Install exact dependencies from `package-lock.json` |
| `npm run typecheck` | `tsc` type check (no output files) |
| `npm test` | Vitest unit and assertion tests |
| `npm run synth` | `cdk synth` for every stack in **dev** and **prod**; fails on any guard error |

**AWS account guard (ARC-32):** the account ID is **not committed**. Set `EXPECTED_AWS_ACCOUNT` (locally, and as a pipeline variable) to the project account:

- Credentials active and matching: synth proceeds.
- Credentials for another account, or credentials active with `EXPECTED_AWS_ACCOUNT` unset: synth **refuses**.
- No credentials: synth only, for `EXPECTED_AWS_ACCOUNT` if set, otherwise AWS's documented placeholder `123456789012`. Nothing can be deployed this way.

**Budget guard (ARC-29):** synth fails if an environment declares a NAT Gateway, RDS Proxy, interface VPC endpoint, load balancer, Multi-AZ or second database, RDS/Aurora cluster, or customer-managed KMS key (`lib/guards/budget-guard.ts`). The error names the rule and the construct path. Adding one of these needs the owner's approval and an ADR (CLAUDE.md §0.6).

**Lambda code (`BACKEND_DIST`):** the Go Lambdas come from the backend build, laid out as `<dir>/<lambda>/bootstrap` (linux/arm64). With AWS credentials active, synth **refuses** unless `BACKEND_DIST` is set, so placeholder code can never be deployed. Without credentials (CI, tests) a placeholder asset is used. To run a credential-less synth on a machine that is logged in to AWS, hide the credentials: `AWS_SHARED_CREDENTIALS_FILE=/nonexistent AWS_CONFIG_FILE=/nonexistent npm run synth`.

**Database roles (S0-08):** the `Custom::DatabaseRoles` resource runs the backend's `dbbootstrap` Lambda once per deploy to create `app_rw` and `migrator` (ADR-0001). The master password reaches it only through a CloudFormation dynamic reference. Bump `DATABASE_ROLES_REVISION` in `lib/app/database-roles.ts` to re-run it after a change.

## Alerts (S0-18)

Each environment has an SNS topic `therapy-service-hours-<env>-alerts` emailing the owner. **Confirm the subscription email once per environment** after the first deploy.

| Alarm | Fires when |
|---|---|
| `<env>-api-5xx` | 5 or more API Gateway 5xx responses in 5 minutes |
| `<env>-api-lambda-errors` | 5 or more api Lambda errors in 5 minutes |
| `<env>-api-lambda-throttles` | any api Lambda throttle in 5 minutes (reserved concurrency reached) |
| `<env>-rds-cpu` | RDS CPU above 80% for 15 minutes |
| `<env>-rds-free-storage` | RDS free storage below 2 GiB |
| `<env>-rds-connections` | more than 60 connections for 10 minutes (budget: 20 api instances x 2) |

Every alarm also notifies when it returns to OK. Thresholds live in `lib/app/alerts.ts` (`ALARM_THRESHOLDS`).

**Budget:** prod defines the account-wide AWS Budget `therapy-service-hours-monthly` ($50/month) with alerts at 80% and 100% of actual spend and 100% of forecast, sent to the prod topic (SEC-82). AWS gives two budgets free; this account already has two, so this one costs about $0.02 a day.

**Test an alarm** (sends a real email, then returns to OK on the next evaluation):

```bash
aws cloudwatch set-alarm-state --alarm-name therapy-service-hours-dev-api-5xx --state-value ALARM --state-reason "manual test"
```

## Layout

```
bin/app.ts        CDK app entry: one stage per environment
config/           Typed per-environment settings (the only place dev and prod differ, ARC-28)
lib/app-stage.ts  One environment: data, app and web stacks plus mandatory tags
lib/app/          Stacks and constructs by concern (network.ts, database.ts)
lib/guards/       Synth-time guards (budget)
test/             Vitest tests (CDK assertions)
```

## Contributing

- `main` is protected: changes go through a pull request with passing checks (ARC-49).
- Work on a branch named after the ticket, for example `feat/S0-03-backend-skeleton`.
- Fill in the PR template, including the standards checklists.
- Client data is **pseudonyms or initials only**, everywhere (CLAUDE.md §0.7).
