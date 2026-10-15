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

> **Prod deploys are off until milestone M3** (owner decision 2026-10-11): `RELEASE.deployProd` in `config/release.ts` is `false`, so runs end after the dev smoke test and no approval is ever pending. To turn prod on, set it to `true` in a PR; the merge's run updates the pipeline and adds the steps below.

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
| Backend / Frontend / Synth | A test, lint or drift-gate failure on `main` | Reproduce locally on that commit; fix forward with a PR. (Dependency audits are not a release gate: they run on PRs and in the weekly `audit` workflow, which opens no deploy risk; fix its findings with a dependency update PR.) Drift gate: run `npm run api:sync` in the frontend and merge |
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
- **AWS Budget** `therapy-service-hours-monthly` (pipeline stack, account-wide, `config/release.ts`): emails at 80% and 100% of actual spend and at 100% of forecast against $50.
- **Monthly check:** Cost Explorer grouped by service and by the `env` tag. Unexpected items: Secrets Manager secrets left from failed deploys, manual snapshots, retained automated backups (`aws rds describe-db-instance-automated-backups`), log groups without retention.
- **Pipeline runs are the swing cost.** Oct 10–13 2026: 65 runs cost about $9.40 in CodeBuild plus CodePipeline (Oct 1–15 total $13.45 against about $0.57/day idle), which lifted the forecast to 103% of budget. Pushes that change only `docs/**` or `*.md` start no run (`DOCS_ONLY_PATHS` in `lib/pipeline/pipeline-stack.ts`), so `STATUS.md` updates go in a separate docs-only PR after the code merges, and related code PRs are combined or merged together (CLAUDE.md rules 10 and 11). Build steps time out after 30 minutes and CodeBuild logs keep 14 days. After changing the triggers, check the next code merge shows trigger type `WebhookV2` (section 4, item 3) and that a docs-only merge starts nothing.
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

See [additional admin and Google-account recovery](#17-additional-admin-and-google-account-recovery-s1-20).
The owner elected to retain the sole dev admin; the reviewed seed supports adding an authorized
second identity without altering the original account.

## 13. S1 identity foundation release

Merge the accepted S1-02 documentation, then the backend S1-15 claims adapter. Coordinate backend
S1-05 and frontend S1-19 in the same source release: their API specs must match byte for byte.
Merge the S1-04 additive identity migration and S1-17 backend role bootstrap before the infra
bootstrap revision changes to 3. The pipeline's data-before-migrate order creates `presignup_ro`
first; migration 00002 grants it SELECT on exactly `users` and `invitations`. The bootstrap also
handles identity tables that already exist. PostgreSQL-wide default SELECT grants are intentionally
absent, so future client-data tables remain inaccessible to the trigger.

Invitations default to **14 days**, with one pending invitation per case-insensitive email. An
expired pending invitation must be revoked before a new one is created. Accepted and revoked
history stays intact. Seed/re-invite operations will be supplied by S1-09; never work around the
allowlist with manual account creation for real users. S1-06 owns the transactional acceptance stamp.

S1-03 must attach `preSignUpDatabaseConnectPolicy` only to the trigger execution role, connect as
`presignup_ro`, and retain isolated-subnet/no-internet constraints. The tested policy helper is
defined in `lib/app/presignup-policy.ts`; this foundation release does not create the trigger.

## 14. Cognito setup and pool replacement (S1-01; rehearse)

### Invitation trigger deployment (S1-03)

The pipeline builds every backend `cmd/*` directory so a new binary exists before infra
synthesis consumes it. Release the backend implementation first, then the infra construct
that adds its name to `BackendLambda`/`BACKEND_LAMBDAS`. For pipelines still using a static
build list, release the build-command change first: otherwise synth cannot reach the
self-mutation that adds the missing binary. Keep `auth.enabled: false` for this preparation
release. The app stack deploys `therapy-service-hours-dev-presignup:live` with 128 MiB,
reserved concurrency 1 and provisioned concurrency 1 (ADR-0007's approved dev cost). The
Go process opens and pings one `presignup_ro` IAM/TLS connection before starting the handler;
initialization failure prevents the provisioned alias from becoming ready.

Before enabling dev auth in a later PR, verify the successful preparation release and
`aws lambda get-provisioned-concurrency-config --function-name therapy-service-hours-dev-presignup --qualifier live`:
status must be READY and allocated/requested concurrency both 1. Also invoke the qualified
alias with a synthetic Google event for an uninvited `example.invalid` email; it must return
`SIGN_UP_NOT_ALLOWED`. Do not print event attributes or credentials when recording evidence.

On activation, the app construct installs the **stable named alias ARN** into the data-owned
pool's CloudFormation `LambdaConfig.PreSignUp`. It computes the ARN using the data stack's
account/region and naming convention, never an app resource token. The only cross-stack
resource references remain app → data. The app grants Cognito invocation on the qualified
alias only, scoped to this pool ARN/account. The prepared alias must exist before activating
a new pool; missing invocation permission during the data-before-app release denies sign-in.
Keeping the trigger in the pool template also preserves it during subsequent pool updates.
Do not call `userPool.addTrigger(appLambda)` or perform a partial `UpdateUserPool` mutation.

The trigger reads only `users` and `invitations`, has no internet or write rights, and never
consumes the invitation. All policy denials return `SIGN_UP_NOT_ALLOWED`; DB/deadline errors
return `SIGN_UP_UNAVAILABLE`. Logs expose only code, request ID and duration. The 3-second
connect and 4-second request limits fail closed. New alarms cover errors, throttles and
maximum duration at 4 seconds; an error alarm includes intentional policy refusals, so inspect
the safe decision code before diagnosing database availability.

For ADR-0011, only dev admin creation of `test-invited`, `test-uninvited`, `test-supervisor`
with matching `<username>@example.invalid` emails bypasses this gate. The uninvited native
user exists to prove API denial; Google federation has no bypass. S1-09 creates these users
from outside the VPC and their DB fixtures through its seed Lambda. Returning Cognito users
do not reach pre-sign-up; S1-06 must reject deactivated users on every API request.

S1-18 still must record real federation and cold/warm p99 against Cognito's five-second ceiling.
Static timeout settings and provisioned concurrency are not measured latency proof. Prod
activation remains M3 and needs the same alias preparation before pool creation.

### Pool replacement recovery

Follow [Google OAuth setup](google-oauth-setup.md) for the two redirect URLs, secret references,
feature plan/cost and activation prerequisites. Dev is enabled by the separate activation
change after those prerequisites and the paired browser/Gateway release; prod stays disabled.

The production pool lives in the **data stack**, has deletion protection and is retained on
delete/replacement (ADR-0009). Replacing it changes every Cognito subject and invalidates
existing `users.cognito_sub` bindings. Rebinding must preserve internal user IDs and all
user-owned data. This recovery procedure requires the S1-06 binding path and S1-09 seed/recovery
tool. Binding and additional-admin seed paths are implemented; a reviewed binding-reset operation
and the live recovery rehearsal are still required, so this is **not yet an executable drill**.

1. Schedule a sign-in maintenance window; retain the old pool and take an RDS recovery point.
   Save the old pool/client/domain configuration and the affected internal user IDs for rollback.
2. Deploy the replacement pool and allowlist attachment, update Google's redirect registration
   if the domain changes, then coordinate the JWT issuer/audience and frontend/CSP configuration.
   Old-pool tokens must stop being accepted before clearing the old bindings.
3. Through the reviewed VPC recovery/seed operation, clear `cognito_sub` for affected active
   users in a transaction. Preserve their UUIDs, organization, status and database role flags.
   Create fresh pending invitations for those active emails (or renew a still-pending invite),
   keeping accepted/revoked history; first sign-in to a new pool needs a pending, unexpired
   invitation even when a user row already exists. Never reactivate a deactivated user.
4. Have an admin sign in with verified Google email. Confirm the existing user UUID is rebound
   to the new subject, the invitation is accepted once and the original roles/data remain.
   Repeat for an ordinary user; confirm an uninvited or deactivated account is denied. No manual
   assignment of arbitrary subjects or Cognito group-based privilege elevation is allowed.
5. Keep the old pool and recovery point until verification is complete. If binding fails, keep
   sign-in unavailable, restore the saved configuration/bindings and investigate. Record the
   rehearsal outcome in S1-18/S11 before treating this as proven recovery.

## 15. Identity seeding (S1-09)

Release the backend build-discovery fix before the backend seed binary, then release the backend
before adding the infra seed construct. Keep auth disabled for this preparation. `Seed-dev` runs
after the app stack, so migrations, function code and the scoped operator role are already ready.
It creates the owner-selected admin users row and invitation plus the two invited synthetic dev
accounts. `test-uninvited@example.invalid` has neither a DB row nor invitation.

The Lambda validates `admin_email`, `include_dev_users`, `allow_prod` against its own `APP_ENV`.
The database operation is one advisory-locked transaction. Repeat runs preserve IDs and expiry;
an expired pending invitation is revoked before one new 14-day invitation is inserted. Accepted
history, Cognito bindings, roles and deactivation are never overwritten. Conflicting state returns
`SEED_CONFLICT` and rolls back earlier writes. Do not bypass that refusal with a manual role reset.

The dev non-VPC CodeBuild runner assumes `therapy-service-hours-dev-seed-operator`, whose trust
allows only the named seed runner role. Permission is restricted to invoking the seed function
and, after auth activation, this pool's native-user operations and this test credential secret.
The script verifies the pool/client names before mutation, suppresses all user notifications,
and creates only `test-invited`, `test-uninvited`, `test-supervisor` at `example.invalid`.
Their generated dev password is shared in one managed secret and never printed or placed in
command arguments. Confirmed identities/passwords and expected groups remain unchanged on rerun;
partial creation completes safely, while disabled users or unexpected groups cause refusal.

The Lambda invocation uses explicit `--function-name` and `--payload fileb://...` arguments;
the payload stays in a temporary file with owner-only permissions. Unlike the generic STS,
Cognito and Secrets Manager commands, Lambda's custom CLI command does not support the
`--cli-input-json` wrapper. If `Seed-dev` reports `SEED_AWS_CALL_FAILED` before any Lambda
logs appear, check command parsing as well as IAM. The initial 2026-10-11 release hit this
parsing error after successfully assuming the operator role and made no database writes.
After merging the invocation repair, let the new source release run; retrying the old failed
execution would reuse the broken script. Check counts-only seed output before moving on.

After release, run the seed again through the authorized pipeline/operator path and verify zero
new accounts/invitations. Invoke `presignup:live` with synthetic Google events: test-invited and
test-supervisor should pass; test-uninvited should return `SIGN_UP_NOT_ALLOWED`. Invoking the
seed in prod without `allow_prod: true`, or with dev fixtures even with that flag, must refuse
before storage. Production automatic seeding and native test credentials are forbidden in synth.

For a manual production seed, use an owner-authorized IAM invocation with a JSON payload file:

```json
{"admin_email":"admin@example.test","include_dev_users":false,"allow_prod":true}
```

Replace the fictional email locally. Do not print the payload in shared logs. The function returns
counts and stable codes only; this operation creates a DB invitation/row, never a native Cognito
identity for the real admin. First Google sign-in and S1-06 perform the subject binding. Additional
admin addresses can be seeded the same way; follow the recovery procedure in section 17.

Test-password rotation is coordinated: changing the managed secret alone leaves existing native
passwords unchanged. Update the three fixed synthetic users through the same scoped IAM operator
using a reviewed operation with captured SDK/CLI input/output. Do not reset arbitrary real users.

## 16. Prepared Gateway and browser sign-in release (S1-14/S1-16/S1-10)

Backend #24 is released in dev execution `af3e6963-7cf5-4857-bfc8-c0a524ba1355`; unauthenticated
`/api/v1/me` returns a no-store 401 problem. Merge and release the infra preparation before the
paired frontend because its header gate requires the exact Cognito origin in `connect-src`.
Both preparation releases kept `auth.enabled=false`. Activation follows in section 18.

When enabled, `GET /api/v1/healthz` is the only unauthenticated Gateway route. The proxy route
uses the pool issuer and SPA client audience; dev additionally accepts its test-only client.
The backend still requires ID-token type and verified identity and reads roles/status from DB.
The curl gate checks no-token `/me` and unknown paths return 401. The separate dev auth gate
assumes a read-only smoke credential role, reads the generated test password, authenticates
the two fixed invited/uninvited native users, checks 200/403 profiles plus authenticated 404,
and revokes both native refresh tokens. It never prints credentials, token responses or bodies.
Prod runs no synthetic identity/password checks and requires separate real-identity acceptance.

Frontend sync generates `auth-config.json` from public deployed outputs. Enabled config must
match the exact configured callback/logout URLs; disabled config contains only `enabled:false`.
The file is uploaded with no-store and invalidated with index.html. No client secret, native
password or test credential ARN enters it. The browser rejects unknown fields/foreign URLs.

After both preparation releases, activation is a separate reviewed config change. Verify pool,
clients, Google mapping, live trigger and seed/native-user creation, then authenticated smoke.
Demonstrate the owner's actual Google sign-in and logout; verify first binding/accepted invitation
and repeated sign-in, deactivation and role changes. Local intercepted browser tests prove PKCE
and UI behavior but do not replace this manual federation or the measured p99 acceptance.

Browser tokens live in memory; only the expiring PKCE state, nonce and verifier use session storage.
Callback processing consumes that transaction and strips code/error query values before exchange.
The classic hosted UI reuses its cookie on reload; `prompt=none` is managed-login-only and is not
sent. Refresh is single-flight; invalidation/logout prevents late responses restoring tokens.
401/403 clears private query cache. Logout attempts refresh revocation then hosted logout even
on network failure; local tokens stay cleared, and a failed revocation is not reported as success.

Measured preparation evidence (2026-10-11): the deployed trigger's two `INIT_REPORT` durations
were 2805.16 and 3057.93 ms; the first synthetic uninvited decision took 66 ms. These are small
samples of provisioned initialization and a warm database-backed request, not cold/warm p99
or real federation proof. S1-18 must collect a representative sample and actual Google sign-ins.

## 17. Additional admin and Google-account recovery (S1-20)

**Owner decision (2026-10-11):** keep the existing owner-selected account as the sole dev
admin for now. No second live address is seeded by this story. The procedure below remains
available if the owner authorizes a second Google identity or loses access to the first.
Production remains deferred to M3; these instructions do not authorize a production invocation.

The seed Lambda already accepts any valid additional admin email. It creates one active
admin row in Default Organization and a pending 14-day invitation. It does not change the
first admin, manufacture a Cognito subject, create a password account or send a notification.
The new admin uses the normal verified Google sign-in and invitation/binding flow. Existing
users with conflicting roles, organization or deactivation cause `SEED_CONFLICT`; this is
bootstrap of an additional identity, not a way to promote or reactivate an existing account.

### Before invoking

1. Obtain the owner's authorization for the exact additional Google identity and target
   environment. Confirm the identity can sign in to Google and the invitation's organization
   is appropriate. Record authorization in the private operational record.
2. Use an authenticated owner-authorized IAM session with `lambda:InvokeFunction` restricted
   to the target seed function. The automatic dev operator trusts only its CodeBuild runner;
   do not widen that trust or try to assume it from a human session. Production has no automatic
   seed operator. Keep the procedure available through the account owner's recovery access.
3. Verify `aws sts get-caller-identity` selects account `098536000083`, and verify the target
   function's deployed `APP_ENV` is the intended environment. Its name is
   `therapy-service-hours-dev-seed` or, after production deployment,
   `therapy-service-hours-prod-seed`. Stop on any mismatch or missing function.
4. Ensure the normal pool, Google provider, allowlist trigger, Gateway and browser configuration
   are released and enabled before expecting sign-in. An auth-disabled seed can prepare the
   database but cannot demonstrate Google access. Confirm the trigger alias is READY.

### Invoke the reviewed seed function

Create `admin-recovery-request.json` in a private local directory accessible only to the
operator. Use a local editor to replace the fictional email with the authorized Google address.
Do not place the address in process arguments, shared shell history, logs or public tickets.
Do not reuse the pipeline's fixed `ADMIN_EMAIL` setting for a one-off recovery operation.

For **dev**:

```json
{"admin_email":"recovery-admin@example.test","include_dev_users":false,"allow_prod":false}
```

```bash
aws lambda invoke --region us-west-2 --function-name arn:aws:lambda:us-west-2:098536000083:function:therapy-service-hours-dev-seed --invocation-type RequestResponse --log-type None --payload fileb://admin-recovery-request.json admin-recovery-response.json --no-cli-pager
```

For **production**, after its release and separate owner authorization, the explicit
`allow_prod:true` flag is mandatory and dev fixtures must remain false:

```json
{"admin_email":"recovery-admin@example.test","include_dev_users":false,"allow_prod":true}
```

```bash
aws lambda invoke --region us-west-2 --function-name arn:aws:lambda:us-west-2:098536000083:function:therapy-service-hours-prod-seed --invocation-type RequestResponse --log-type None --payload fileb://admin-recovery-request.json admin-recovery-response.json --no-cli-pager
```

Use the matching function and payload together. The flag alone never changes the Lambda's
environment, and a production request without the flag is refused before opening storage.
These single-line AWS CLI commands also work in PowerShell from the private directory.

### Verify and finish

1. Check the invocation metadata for `FunctionError`, then inspect the response file.
   A successful Lambda invocation status alone is insufficient: the response must contain
   `status:"ok"`. For a new address expect one account and one invitation created, zero renewed.
   Repeating the same pending request before expiry must return all zero counts. Expired pending
   invitations are revoked and replaced, preserving history; a bound account is not re-invited.
2. Treat `SEED_NOT_ALLOWED`, `INVALID_SEED_REQUEST`, `SEED_CONFLICT` and `SEED_UNAVAILABLE`
   as refusals. Use safe Lambda request IDs and codes to investigate. Do not clear bindings,
   reset roles or reactivate an account to bypass a conflict. If an invocation times out after
   writing, retry the same authorized payload; the database operation is atomic and idempotent.
3. Within 14 days, have the additional admin use normal Google sign-in. Confirm `/api/v1/me`
   shows the admin role from the database and the intended organization. Confirm the original
   admin remains unchanged. Later admin-console slices supply privileged endpoint checks;
   token groups alone never prove application authority. Record only safe acceptance evidence.
4. Delete the local request file when no longer needed; preserve counts, request IDs and the
   authorization record privately. Seeding has no automatic rollback: any subsequent removal
   of the added privilege requires a separately authorized account-management change. Losing
   a Google account does not justify transferring its Cognito subject to a different email.

Regression verification lives in backend `internal/migrate/admin_recovery_test.go`: PostgreSQL
tests add and bind a separate admin in dev and explicitly opted-in prod, preserve the original
bound account and invitation history, confirm repeat idempotency, and prove prod refusal makes
no database changes. These use fictional identities and do not claim a live recovery drill.

## 18. Dev auth activation and acceptance

The activation change enables only `config/dev.ts` auth. Production auth and
`RELEASE.deployProd` remain false. Backend identity and the paired Gateway/browser preparation
are released; S1-20's owner decision keeps the sole real dev admin. Preflight on 2026-10-11
confirmed the Google secret has AWSCURRENT, the pre-sign-up alias is READY at 1/1, and direct
synthetic Google events allow test-invited and deny test-uninvited with `SIGN_UP_NOT_ALLOWED`.
These direct invocations are not federation or p99 evidence.

After the reviewed activation merges, allow the queued pipeline to finish self-mutation and
any replacement execution, then require a successful complete dev release:

1. Verify the data pool is Lite/classic hosted UI, Google-only SPA/code client with the exact
   callback/logout URLs, mapped verified email, and the stable `presignup:live` trigger ARN.
   The app must grant invocation only to this pool/account. Check alias concurrency remains READY.
   During data-before-app deployment, missing pool-scoped permission denies sign-in; it never
   permits an uninvited account. Do not treat the middle of deployment as acceptance.
2. Confirm the generated dev-only native credential secret, password test client and three fixed
   synthetic users were seeded. The database uninvited user/invitation must remain absent.
   Check counts-only seed results; do not print passwords, Google details or token responses.
3. Require authenticated smoke to pass invited `/me` 200, uninvited `/me` 403 and authenticated
   unknown-path 404, with refresh-token revocation. No-token `/me` and unknown paths must return
   Gateway 401; public health remains 200. Native tests do not replace Google acceptance.
4. Inspect public `auth-config.json`: enabled true, exact deployed issuer/client/domain and
   callback/logout URLs, no-store. Confirm CloudFront invalidation and the exact Cognito CSP
   origin; no secret or test credential ARN may enter the file or browser bundle.
5. Have the authorized owner demonstrate actual Google first sign-in, repeat sign-in and logout.
   Verify one preserved internal UUID/subject binding and one accepted invitation. Capture only
   safe outcomes, not identity attributes or callback codes. S1-18 also requires actual uninvited
   refusal, deactivation enforcement and representative cold/warm trigger latency samples; static
   timeouts and isolated initialization durations are insufficient to report p99.

If a stage fails, investigate that execution's stable codes and request IDs before retrying;
retry the same source release when safe rather than changing deployed pool settings manually.
Keep the pool and existing bindings while diagnosing. **Do not use `auth.enabled:false` as a
routine rollback after pool creation:** dev's removal policy deletes the pool, changing subjects
on recreation and requiring a reviewed recovery/rebinding procedure. If access must be paused,
prepare a reviewed change that disables the browser entry point while preserving the pool and
Gateway protection. Keep incomplete live acceptance tickets in progress.
