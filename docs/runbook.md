# Runbook v0: Therapy Service Hours Tracker

> Operating procedures for the owner (S0-21, ARC-46). Covers both environments in AWS account `EXPECTED_AWS_ACCOUNT`, region **us-west-2**.
> Version 0: written before the first full deploy. Steps marked **(rehearse)** have not been run against a real environment yet; the restore drill before go-live (S11, ARC-36) finalizes them.

## Contents

1. [Environments at a glance](#1-environments-at-a-glance)
2. [Deploy flow](#2-deploy-flow)
3. [Approving a prod release](#3-approving-a-prod-release)
4. [Pipeline failure: first response](#4-pipeline-failure-first-response)
5. [Rollback](#5-rollback)
6. [Alarms: what they mean and what to do](#6-alarms-what-they-mean-and-what-to-do)
7. [Database restore](#7-database-restore)
8. [Adding a migration (expand/contract)](#8-adding-a-migration-expandcontract)
9. [Budget guard and cost](#9-budget-guard-and-cost)
10. [RDS CA bundle refresh (yearly)](#10-rds-ca-bundle-refresh-yearly)
11. [Accepted risks and known exposures](#11-accepted-risks-and-known-exposures)
12. [First-admin recovery](#12-first-admin-recovery)

---

## 1. Environments at a glance

| | Dev | Prod |
|---|---|---|
| Stacks | `therapy-service-hours-dev-data`, `-dev-app`, `-dev-web` | `therapy-service-hours-prod-data`, `-prod-app`, `-prod-web` |
| Promotion | Automatic on merge to `main` (any repo) | **Manual approval** after dev passes its smoke test |
| Database | `therapy-service-hours-dev-postgres`, 1-day backups, no deletion protection | `therapy-service-hours-prod-postgres`, **7-day backups (PITR)**, deletion protection, snapshot before every release |
| Logs | 14 days | 30 days |
| Alerts | SNS topic `therapy-service-hours-dev-alerts` → owner email | `therapy-service-hours-prod-alerts` → owner email, plus the **$50/month AWS Budget** |
| URL | `Url` output of the web stack | `Url` output of the web stack |

Find an environment's URL:

```bash
aws cloudformation describe-stacks --stack-name therapy-service-hours-dev-web --query "Stacks[0].Outputs[?OutputKey=='Url'].OutputValue" --output text
```

Pipeline notifications (failed, approval needed, succeeded) go to the SNS topic `therapy-service-hours-pipeline`. **Confirm each SNS subscription email once** after its stack is first deployed, or no alert arrives.

## 2. Deploy flow

**Normal path: the pipeline** (`therapy-service-hours`, ADR-0005). Merge a PR to `main` in any of the three repos; one run starts and releases all three at their current `main` commits.

```
Source (3 repos) → Build: Backend ‖ Frontend → Synth → UpdatePipeline (self-mutation) → Assets
  → Dev: data stack → Migrate-dev → app stack → web stack → FrontendSync-dev → Smoke-dev
  → Prod: ReleaseInfo → PromoteToProd (manual approval)
        → Snapshot-prod → data stack → Migrate-prod → app stack → web stack → FrontendSync-prod → Smoke-prod
```

- **Build** runs the same gates as the PR checks (vet and tests; lint, type check, format, tests, the OpenAPI **drift gate**; infra tests and `cdk synth` with the budget guard). Any failure stops the run before anything deploys.
- **Migrate** invokes the migrate Lambda and fails unless it returns `"status":"ok"`, so a broken migration stops the run **before** the app stack changes (ADR-0003).
- **Smoke** runs `scripts/smoke.sh` and then the frontend's Playwright spec against the CloudFront URL. A failure stops the run, so prod is never offered for approval.
- Runs are **queued**, never superseded: a later merge waits behind a pending approval.

**Exception path: manual deploy of one stack** (bootstrap, the pipeline stack itself, or an emergency). Use a dedicated, clean checkout of `origin/main` and the guard script, which refuses anything else:

```bash
git clone https://github.com/malcolmjefferson/therapy_service_hours_infra.git therapy_service_hours_infra-deploy
cd therapy_service_hours_infra-deploy && git checkout --detach origin/main && npm ci
aws login   # MFA
EXPECTED_AWS_ACCOUNT=<account> BACKEND_DIST=<backend build dir with VERSION> scripts/deploy.sh dev/Data
```

`BACKEND_DIST` is a backend build laid out as `<dir>/<lambda>/bootstrap` plus `VERSION` (see the backend README, "Build the Lambdas"). Never deploy from a feature branch.

**First-time pipeline setup** (owner, once):

1. Deploy the pipeline stack: `scripts/deploy.sh Pipeline` (stack `therapy-service-hours-pipeline`).
2. Console → **Developer Tools → Settings → Connections** → `therapy-service-hours-github` → **Update pending connection** and authorize the three repos. The `ConnectionArn` output names it.
3. Confirm the pipeline SNS subscription email.
4. **Release change** in the CodePipeline console (or merge any PR) to start the first run.

## 3. Approving a prod release

1. The approval email arrives ("manual approval needed").
2. In the run, open **ReleaseInfo** and note the three commits (infra, backend, frontend).
3. Check the dev URL yourself: the start page loads and shows **Up** with the backend commit as the version.
4. Read the merged PRs for those commits. **Hold the approval** if any of them contains a `-- +contract` migration whose expand step has not been in prod for at least one release (section 8).
5. **Approve** or **Reject** `PromoteToProd`. Reject leaves prod untouched; the next merge starts a new run.

Anyone allowed `codepipeline:PutApprovalResult` on the pipeline can approve; today that is only the owner's IAM user. Keep it that way.

## 4. Pipeline failure: first response

You receive "pipeline execution failed". Then:

1. **Find the failed action**: CodePipeline console → `therapy-service-hours` → the red stage → **View details** → **Logs** (CodeBuild) or **Events** (CloudFormation).
2. **Classify it** and act:

| Failed at | Likely cause | First response |
|---|---|---|
| Source | GitHub connection not authorized or revoked | Re-authorize the connection (section 2, step 2), then **Retry** |
| Backend / Frontend / Synth | A test, lint, audit or drift-gate failure on `main` | Reproduce locally on that commit; fix forward with a PR. `npm audit` failures: update the dependency or wait for a fix; do not lower the audit level. Drift gate: run `npm run api:sync` in the frontend and merge |
| UpdatePipeline / Assets | IAM or bootstrap problem | Check the CodeBuild log; if the CDK bootstrap stack changed, re-run bootstrap (owner) |
| Deploy (CloudFormation) | Resource error | CloudFormation console → the stack → **Events**, first `*_FAILED` row. The stack rolls back by itself; **wait for `UPDATE_ROLLBACK_COMPLETE`** (or `ROLLBACK_COMPLETE`) before anything else |
| ConcurrencyPreflight-* | `PREFLIGHT FAIL`: the api Lambda's reserved concurrency would leave under 100 unreserved Lambda concurrency in the account. Nothing was deployed | Check `aws lambda get-account-settings`. Request a higher quota (`aws service-quotas request-service-quota-increase --service-code lambda --quota-code L-B99A9384 --desired-value 1000`), or lower `api.reservedConcurrency` in `config/` by PR. Then **Retry** |
| Migrate-* | Migration error (the run stops before the app changes) | `result.json` in the log has the error. Fix with a **new** migration (never edit an applied one); see section 8 |
| FrontendSync-* | S3 or invalidation permission | Check the log; retrying is safe (uploads are idempotent) |
| Smoke-* | Environment broken, or a header/route regression | The log names the failing check (`SMOKE FAIL: ...` or the Playwright test). Fix forward, or roll back (section 5) |
| Snapshot-prod | Snapshot quota or a pending snapshot | Check RDS → Snapshots; delete old manual snapshots outside the `pre-release-` prefix if over quota, then **Retry** |

3. **Merges start no run** (Release change works): GitHub push events are not reaching the pipeline. This happens when the pipeline was created while its connection was still PENDING, and saving the pipeline unchanged does not fix it. Check that the AWS Connector for GitHub app can access all three repos (GitHub → Settings → Applications → Installed GitHub Apps), then run `scripts/reregister-push-triggers.sh` (after `aws login`). It updates the pipeline twice (without, then with its push triggers) and ends identical to the CDK definition. An update may start a run. Verify with the next merge: `aws codepipeline list-pipeline-executions --pipeline-name therapy-service-hours --max-items 1 --query "pipelineExecutionSummaries[0].trigger.triggerType"` shows `WebhookV2`.
4. **Retry vs new run:** use **Retry** only for transient causes (throttling, a timeout, a just-fixed connection). For code problems, merge a fix; the queued run picks it up.
5. **"Log group ... already exists"** during early validation: a Lambda recreated its log group after the stack deleted it. Every named function now has an explicit Deny on `logs:CreateLogGroup` for its own log group, so this should not recur. If it does, check the group is empty (`storedBytes` 0) and delete it: `MSYS_NO_PATHCONV=1 aws logs delete-log-group --log-group-name <name>` (`MSYS_NO_PATHCONV` stops Git Bash rewriting the leading `/`).
6. A stack stuck in `UPDATE_ROLLBACK_FAILED`: CloudFormation console → **Continue update rollback**, skipping only the resource named in the error. Never delete a prod data stack to get unstuck.

## 5. Rollback

**Default: roll forward.** Revert the offending PR in its repo and merge; the pipeline releases the previous behavior through dev and the approval as normal.

**Faster: redeploy the previous commits.** The pipeline is V2, so either:

- **Start rollback** on the Dev or Prod stage: CodePipeline redeploys that stage with the source revisions of its last successful execution, or
- **Release change** with **source revision overrides**: pin the three repos to the last good commits (from an earlier ReleaseInfo log). The run goes through dev, smoke and the approval as normal.

**Database changes do not roll back.** Migrations are forward-only (ARC-24). Because every migration is expand-first, the previous app version still works against the newer schema. If data was damaged, see section 7.

## 6. Alarms: what they mean and what to do

Every alarm emails the environment's alert topic on **ALARM** and again on **OK**. Missing data counts as OK, so an idle environment is quiet. Names are prefixed `therapy-service-hours-<env>-`.

| Alarm | Fires when | First response |
|---|---|---|
| `api-5xx` | 5 or more API 5xx responses in 5 minutes | Logs Insights on the api Lambda log group: `fields @timestamp, level, msg, request_id, error \| filter level = "ERROR" \| sort @timestamp desc`. If a release just went out, roll back (section 5) |
| `api-lambda-errors` | 5 or more api Lambda errors (crashes, timeouts) in 5 minutes | Same query; look for `Task timed out` or panics. Database down → check RDS |
| `api-lambda-throttles` | Any throttle: reserved concurrency (20) was reached | Check API Gateway request counts for abuse vs real load. Raising reserved concurrency needs the DB connection budget (pool size × concurrency < about 80) |
| `rds-cpu` | CPU above 80% for 15 minutes | RDS **Performance Insights** / slow-query log (`log_min_duration_statement` 1 s) for the expensive statement; add an index via a migration |
| `rds-free-storage` | Free storage below 2 GiB | Storage autoscales to 50 GiB; if it keeps falling, find the growing table. Raising `maxAllocatedStorage` costs money: owner decision |
| `rds-connections` | More than 60 connections for 10 minutes | Throttling or a connection leak: check Lambda concurrency and `pgx` pool settings |
| AWS Budget (prod) | Actual spend reaches 80% or 100% of $50, or the forecast reaches 100% | Cost Explorer by service. A resource the budget guard forbids should not exist; delete anything created by hand |

Logs: Lambda log groups `/aws/lambda/therapy-service-hours-<env>-*`, API access logs, and RDS `postgresql` logs in CloudWatch. **Logs never contain client names, notes or passwords**: if you see one, treat it as an incident and fix the logging.

## 7. Database restore

Targets (ARC-36): prod **RPO 5 minutes** (point-in-time recovery) and **RTO 4 hours**. Sources:

- **Point-in-time** (prod, last 7 days): automated backups.
- **Pre-release snapshots** `therapy-service-hours-prod-pre-release-<UTC time>`: the newest three, taken before each prod migration.

**Procedure (rehearse):**

1. **Stop writes:** note the time of the incident. Reject any pending prod approval.
2. **Restore beside the original**, never over it. The restored instance must match the CDK settings: private subnets, the database security group, the parameter group, IAM auth on, encryption (inherited).

   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier therapy-service-hours-prod-postgres \
     --target-db-instance-identifier therapy-service-hours-prod-postgres-restore \
     --restore-time <UTC ISO time before the incident> \
     --db-subnet-group-name <subnet group of the original> \
     --vpc-security-group-ids <database security group of the original> \
     --db-parameter-group-name <parameter group of the original> \
     --db-instance-class db.t4g.micro --no-multi-az --no-publicly-accessible \
     --enable-iam-database-authentication --manage-master-user-password --copy-tags-to-snapshot
   ```

   For a snapshot, use `restore-db-instance-from-db-snapshot --db-snapshot-identifier <name>` with the same options. Read the subnet group, security group and parameter group names from `aws rds describe-db-instances --db-instance-identifier therapy-service-hours-prod-postgres`.

3. **Wait** until the restored instance is `available`. There is no direct database access (no bastion, by budget), and the database is never opened to the internet; the data is checked through the app after cutover, with the original kept for swapping back.
4. **Cut over by swapping identifiers**, so the CDK-managed name and endpoint stay the same:

   ```bash
   aws rds modify-db-instance --db-instance-identifier therapy-service-hours-prod-postgres --new-db-instance-identifier therapy-service-hours-prod-postgres-old --apply-immediately
   # wait until it is available
   aws rds modify-db-instance --db-instance-identifier therapy-service-hours-prod-postgres-restore --new-db-instance-identifier therapy-service-hours-prod-postgres --apply-immediately
   ```

5. Turn **deletion protection** on for the restored instance. Run the pipeline (or `scripts/deploy.sh prod/Data`) so CloudFormation reconciles its settings, then run drift detection on the data stack. The restored instance has a **new** RDS-managed master secret: confirm the role bootstrap and the stack output reference it.
6. **Check through the app** that the latest entries before the incident are there. If the restore point is wrong, swap the identifiers back and restore again.
7. Keep `-old` until the restore is confirmed (deletion protection on), then delete it with a final snapshot.

**Dev:** recreate instead of restoring. Dev data is disposable.

**AZ outage** is an accepted risk (ARC-37): the database is single-AZ. The app is down until RDS recovers in that AZ or you restore into the other AZ with the procedure above.

## 8. Adding a migration (expand/contract)

Migrations are **forward-only** and run **before** the new app version deploys, so each one must work with both the old and the new code.

1. **Expand** (release N): add things only. New tables, nullable columns or columns with defaults, new indexes (`CREATE INDEX CONCURRENTLY` needs `-- +goose NO TRANSACTION`). Ship the code that writes both old and new shapes.
2. **Migrate data** (release N or N+1): backfill in a migration or a job, in batches.
3. **Switch reads** (release N+1): the code uses only the new shape.
4. **Contract** (release N+2 or later, after N+1 is in prod): drop or rename the old thing in a file marked `-- +contract`. CI (`scripts/check-migrations.sh`) rejects `DROP`, `TRUNCATE`, `RENAME` or `ALTER ... DROP` without that marker.

How-to (backend repo):

```bash
cd therapy_service_hours_backend
# next number after the highest in db/migrations/
$EDITOR db/migrations/00002_<what>.sql   # -- +goose Up only; no Down
go test ./internal/migrate/...           # applies every migration to a Testcontainers Postgres
```

- **Never edit a migration that has run anywhere.** Fix with a new one.
- Grant the app role access to new tables in the same migration (`GRANT SELECT, INSERT, UPDATE, DELETE ... TO app_rw`); audit tables get `SELECT, INSERT` only (ARC-23).
- The migration runs as `migrator` under an advisory lock; a concurrent run waits.

## 9. Budget guard and cost

- **Target:** under **$50/month for both environments** (about $35–45 expected; two `db.t4g.micro` instances are most of it).
- **Synth-time guard** (`lib/guards/budget-guard.ts`): `cdk synth` fails if any stack declares a NAT Gateway, RDS Proxy, interface VPC endpoint, load balancer, Multi-AZ or second database, an RDS/Aurora cluster, or a customer-managed KMS key. Adding one needs the **owner's approval and an ADR**.
- **AWS Budget** `therapy-service-hours-monthly` (prod stack, account-wide): emails at 80% and 100% of actual spend and at 100% of forecast against $50.
- **Monthly check:** Cost Explorer grouped by service and by the `env` tag. Unexpected items: Secrets Manager secrets left from failed deploys, manual snapshots, retained automated backups (`aws rds describe-db-instance-automated-backups`), log groups without retention.
- Optional saving: stop the dev database when idle (`aws rds stop-db-instance`); RDS restarts it after 7 days.

## 10. RDS CA bundle refresh (yearly)

The Lambdas verify the database certificate against `internal/db/certs/us-west-2-bundle.pem` (backend repo, SEC-43). Once a year, and whenever AWS announces an RDS CA rotation:

1. Follow `internal/db/certs/README.md` in the backend repo: download the bundle and compare the SHA-256.
2. If it changed: replace the file, run `go test ./internal/db/...`, update the hash in that README and merge. The pipeline releases it.
3. Only **after** the new bundle is in prod, change the instance CA (`aws rds modify-db-instance --ca-certificate-identifier ...`), dev first.

Current CAs expire in 2061 (RSA2048) and 2121 (RSA4096, ECC384).

### Minor version upgrades

`lib/app/database.ts` pins the PostgreSQL minor version (`POSTGRES_ENGINE_VERSION`), and automatic minor upgrades are off, so the template always matches the instance. Monthly, or when AWS announces a security release:

1. List versions: `aws rds describe-db-engine-versions --engine postgres --engine-version 17 --query "DBEngineVersions[].EngineVersion"`.
2. Bump the constant in a PR. The pipeline applies it to dev, then to prod after approval; the instance restarts during that deploy (a few minutes of downtime).

## 11. Accepted risks and known exposures

- **API Gateway default endpoint is public** (ADR-0004). Users go through CloudFront, but `https://<api-id>.execute-api.us-west-2.amazonaws.com` (the `ApiEndpoint` output) is reachable directly and its responses skip the CloudFront security headers. Mitigations: every route except `/api/v1/healthz` requires a Cognito JWT (S1), stage throttling applies on both paths, and the API returns JSON only (no HTML to frame or script).
- **Single-AZ database:** see section 7.
- **In-app notifications only:** the owner must check alerts email for operations; users see notifications only when they open the app.

## 12. First-admin recovery

Comes with S1 (Cognito and the first-admin seed). Until then there are no application users.
