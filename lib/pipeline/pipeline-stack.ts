import { ArnFormat, Aspects, Aws, CfnOutput, Duration, Stack, StackProps, Tags } from 'aws-cdk-lib/core';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codeconnections from 'aws-cdk-lib/aws-codeconnections';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { APP_NAME, devConfig, EnvConfig, prodConfig, resourcePrefix } from '../../config';
import { TherapyServiceHoursStage } from '../app-stage';
import { addMonthlyBudget } from '../app/alerts';
import { LambdaArtifacts } from '../artifacts';
import { BudgetGuard } from '../guards/budget-guard';

/** The three GitHub repositories the pipeline releases together (ADR-0005). */
export const REPOSITORIES = {
  infra: 'malcolmjefferson/therapy_service_hours_infra',
  backend: 'malcolmjefferson/therapy_service_hours_backend',
  frontend: 'malcolmjefferson/therapy_service_hours_frontend',
} as const;

/** Branch every source follows. */
export const RELEASE_BRANCH = 'main';

/** The Lambdas the backend build produces, one directory each under its output. */
/**
 * Unreserved Lambda concurrency that must remain after the api Lambda's reservation. AWS's own
 * floor is 10; the margin keeps headroom for the other functions (migrate, role bootstrap,
 * CDK helpers) and the other environment.
 */
export const MIN_UNRESERVED_CONCURRENCY = 100;

export const BACKEND_LAMBDAS = ['api', 'migrate', 'dbbootstrap', 'dbbootstrap-provider', 'presignup', 'seed'] as const;

/** Props for {@link PipelineStack}. */
export interface PipelineStackProps extends StackProps {
  /** The account every stage deploys to (resolved and checked by lib/account.ts). */
  readonly account: string;
  /** Lambda code for the stages (from BACKEND_DIST in the pipeline's synth step). */
  readonly artifacts: LambdaArtifacts;
  /** Owner email for pipeline failure and approval notifications. */
  readonly notificationEmail: string;
  /** Whether runs continue to prod after dev (config/release.ts; off until M3). */
  readonly deployProd: boolean;
  /** The account-wide monthly AWS Budget in USD (config/release.ts). */
  readonly monthlyBudgetUsd: number;
}

/**
 * The single release pipeline (S0-14, ADR-0005): CDK Pipelines on CodePipeline V2 in QUEUED mode.
 *
 * - Three sources through one CodeConnections GitHub connection. A merge to `main` in any repo
 *   starts one run, and every run shows the commit of all three.
 * - Build stage: backend (vet, unit tests, arm64 Lambda binaries) and frontend (lint, type check,
 *   format, tests, API drift gate, build) in parallel, then infra synth (type check, tests,
 *   `cdk synth` with the budget guard) using the backend binaries. Any failure stops the run.
 * - Self-mutation: the pipeline updates itself from the infra repo before deploying.
 * - Each environment ends with a smoke test (scripts/smoke.sh, then the frontend's Playwright spec).
 * - Failures notify the owner through SNS.
 *
 * The connection is created PENDING; the owner authorizes it once in the console (an owner action).
 */
export class PipelineStack extends Stack {
  readonly pipeline: pipelines.CodePipeline;
  readonly frontendBuild: pipelines.CodeBuildStep;
  readonly sources: Record<keyof typeof REPOSITORIES, pipelines.CodePipelineSource>;
  readonly dev: TherapyServiceHoursStage;
  /** Undefined while prod deploys are off (RELEASE.deployProd). */
  readonly prod?: TherapyServiceHoursStage;
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    // The pipeline is billable infrastructure too: same budget guard and tags as the stages.
    Aspects.of(this).add(new BudgetGuard());
    Tags.of(this).add('app', APP_NAME);
    Tags.of(this).add('env', 'shared');
    Tags.of(this).add('owner', devConfig.owner);

    const connection = new codeconnections.CfnConnection(this, 'GitHubConnection', {
      connectionName: `${APP_NAME}-github`,
      providerType: 'GitHub',
    });
    const source = (repo: string) =>
      pipelines.CodePipelineSource.connection(repo, RELEASE_BRANCH, {
        connectionArn: connection.attrConnectionArn,
        triggerOnPush: true,
      });
    this.sources = { infra: source(REPOSITORIES.infra), backend: source(REPOSITORIES.backend), frontend: source(REPOSITORIES.frontend) };

    const backendBuild = new pipelines.CodeBuildStep('Backend', {
      input: this.sources.backend,
      // The image ships an older Go; go.mod pins the toolchain and GOTOOLCHAIN=auto fetches it.
      partialBuildSpec: codebuild.BuildSpec.fromObject({ phases: { install: { 'runtime-versions': { golang: '1.24' } } } }),
      env: { GOTOOLCHAIN: 'auto', CGO_ENABLED: '0', COMMIT_ID: this.sources.backend.sourceAttribute('CommitId') },
      commands: [
        'go version',
        'go vet ./...',
        'go test ./...',
        // Build new backend commands before a later infra revision references their artifacts.
        // A static list here prevents synth from reaching the self-mutation that extends it.
        'set -e; for dir in cmd/*; do [ -d "$dir" ] || continue; c="${dir#cmd/}"; GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o "dist/$c/bootstrap" "./$dir"; done',
        'echo "$COMMIT_ID" > dist/VERSION',
      ],
      primaryOutputDirectory: 'dist',
    });

    this.frontendBuild = new pipelines.CodeBuildStep('Frontend', {
      input: this.sources.frontend,
      additionalInputs: { '../backend': this.sources.backend },
      partialBuildSpec: codebuild.BuildSpec.fromObject({ phases: { install: { 'runtime-versions': { nodejs: '22' } } } }),
      commands: [
        // No npm audit here: a newly published advisory would block unrelated releases. PRs and
        // a weekly scheduled job audit dependencies in GitHub Actions instead (SEC-71).
        'npm ci',
        'npm run lint',
        'npm run typecheck',
        'npm run format:check',
        'npm test',
        // Drift gate (ADR-0006): the pinned spec must equal the backend spec being released.
        'npm run api:drift -- --backend-spec ../backend/api/openapi.yaml',
        'npm run build',
      ],
      primaryOutputDirectory: 'dist',
    });

    const synth = new pipelines.CodeBuildStep('Synth', {
      input: this.sources.infra,
      additionalInputs: {
        'backend-dist': backendBuild,
        // Not read by synth: makes the frontend build finish (or fail) before anything deploys.
        'frontend-dist': this.frontendBuild,
      },
      partialBuildSpec: codebuild.BuildSpec.fromObject({ phases: { install: { 'runtime-versions': { nodejs: '22' } } } }),
      env: { EXPECTED_AWS_ACCOUNT: Aws.ACCOUNT_ID, BACKEND_DIST: 'backend-dist' },
      commands: ['npm ci', 'npm run typecheck', 'npm test', 'python3 -m unittest discover -s test -p "test_seed_dev.py"', 'npx cdk synth --quiet'],
      primaryOutputDirectory: 'cdk.out',
    });

    const codePipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: APP_NAME,
      pipelineType: codepipeline.PipelineType.V2,
      // Runs queue instead of superseding each other, so a pending prod approval is never skipped.
      executionMode: codepipeline.ExecutionMode.QUEUED,
      restartExecutionOnUpdate: true,
      crossAccountKeys: false,
    });

    this.pipeline = new pipelines.CodePipeline(this, 'Release', {
      codePipeline,
      synth,
      selfMutation: true,
      dockerEnabledForSynth: false,
      codeBuildDefaults: {
        buildEnvironment: { buildImage: codebuild.LinuxBuildImage.STANDARD_7_0, computeType: codebuild.ComputeType.SMALL },
      },
    });

    this.dev = new TherapyServiceHoursStage(this, 'Dev', {
      config: devConfig,
      artifacts: props.artifacts,
      env: { account: props.account, region: devConfig.region },
    });
    this.pipeline.addStage(this.dev, {
      stackSteps: [
        // ADR-0003: migrations run after the data stack and before the app stack.
        { stack: this.dev.dataStack, pre: [this.concurrencyPreflightStep(devConfig)], post: [this.migrateStep(this.dev, devConfig)] },
        { stack: this.dev.appStack, post: devConfig.seed.onDeploy ? [this.seedStep(this.dev, devConfig)] : [] },
        { stack: this.dev.webStack, post: [this.frontendSyncStep(this.dev, devConfig)] },
      ],
      post: [this.smokeStep(this.dev, devConfig)],
    });

    if (props.deployProd) {
      this.prod = this.addProd(props);
    }

    this.pipeline.buildPipeline();

    this.topic = new sns.Topic(this, 'Notifications', {
      topicName: `${APP_NAME}-pipeline`,
      displayName: 'Therapy Service Hours pipeline',
      enforceSSL: true,
    });
    this.topic.addSubscription(new subscriptions.EmailSubscription(props.notificationEmail));
    this.notifyOn(this.pipeline.pipeline.pipelineName);
    // The account-wide budget lives here, the one stack always deployed (prod waits for M3).
    addMonthlyBudget(this, 'MonthlyBudget', this.topic, props.monthlyBudgetUsd);

    new CfnOutput(this, 'ConnectionArn', {
      description: 'Authorize this GitHub connection once in the console (Developer Tools > Connections)',
      value: connection.attrConnectionArn,
    });
  }

  /**
   * S0-16: release info, the owner's approval, then prod with the same synthesized assembly (same
   * Lambda zips and templates tested in dev). Added only while RELEASE.deployProd is on.
   */
  private addProd(props: PipelineStackProps): TherapyServiceHoursStage {
    // S0-16: prod gets the same synthesized assembly, so the same Lambda zips and templates tested in dev.
    const prod = new TherapyServiceHoursStage(this, 'Prod', {
      config: prodConfig,
      artifacts: props.artifacts,
      env: { account: props.account, region: prodConfig.region },
    });
    const releaseInfo = new pipelines.CodeBuildStep('ReleaseInfo', {
      env: {
        INFRA_COMMIT: this.sources.infra.sourceAttribute('CommitId'),
        BACKEND_COMMIT: this.sources.backend.sourceAttribute('CommitId'),
        FRONTEND_COMMIT: this.sources.frontend.sourceAttribute('CommitId'),
      },
      commands: ['echo "Release candidate: infra $INFRA_COMMIT, backend $BACKEND_COMMIT, frontend $FRONTEND_COMMIT"'],
    });
    const approval = new pipelines.ManualApprovalStep('PromoteToProd', {
      comment:
        'Deploy to prod the exact artifacts that passed dev and its smoke test. The three commits are the source ' +
        'revisions of this execution (also printed by the ReleaseInfo step). Rejecting leaves prod untouched.',
    });
    approval.addStepDependency(releaseInfo);
    // The preflight runs before the snapshot, so a blocked release changes nothing at all.
    const prodPreflight = this.concurrencyPreflightStep(prodConfig);
    const prodSnapshot = this.snapshotStep(prodConfig);
    prodSnapshot.addStepDependency(prodPreflight);
    this.pipeline.addStage(prod, {
      pre: [releaseInfo, approval],
      stackSteps: [
        // ADR-0003: snapshot, then data stack, then migrations, then the app.
        { stack: prod.dataStack, pre: [prodPreflight, prodSnapshot], post: [this.migrateStep(prod, prodConfig)] },
        { stack: prod.webStack, post: [this.frontendSyncStep(prod, prodConfig)] },
      ],
      post: [this.smokeStep(prod, prodConfig)],
    });
    return prod;
  }

  /**
   * Emails the owner when a run fails or succeeds and when the prod approval is waiting, through
   * EventBridge rules on CodePipeline's own state-change events (free for AWS service events).
   * CodeStar Notifications rejected this topic at deploy time ("Invalid request provided"), and
   * EventBridge needs no extra service.
   */
  private notifyOn(pipelineName: string): void {
    const field = (path: string) => events.EventField.fromPath(path);
    const target = (message: string) => new targets.SnsTopic(this.topic, { message: events.RuleTargetInput.fromText(message) });
    new events.Rule(this, 'RunFinishedRule', {
      ruleName: `${APP_NAME}-pipeline-run-finished`,
      description: 'Pipeline run failed or succeeded: email the owner',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: { pipeline: [pipelineName], state: ['FAILED', 'SUCCEEDED'] },
      },
      targets: [target(`Pipeline ${field('$.detail.pipeline')} run ${field('$.detail.execution-id')}: ${field('$.detail.state')} (${field('$.region')}).`)],
    });
    new events.Rule(this, 'ApprovalNeededRule', {
      ruleName: `${APP_NAME}-pipeline-approval-needed`,
      description: 'The prod approval is waiting: email the owner',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Action Execution State Change'],
        detail: { pipeline: [pipelineName], state: ['STARTED'], type: { category: ['Approval'] } },
      },
      targets: [
        target(`Pipeline ${field('$.detail.pipeline')} run ${field('$.detail.execution-id')}: approval ${field('$.detail.action')} is waiting. Check ReleaseInfo, then approve or reject in the CodePipeline console.`),
      ],
    });
  }

  /**
   * Fails the release before anything in the environment changes if the api Lambda's reserved
   * concurrency would not fit the account's Lambda concurrency quota. Without it, the data stack
   * and migrations apply and only the app stack then fails, leaving the environment half-released
   * (as on the first dev run: the new account's quota was 10, so no reservation was possible).
   */
  private concurrencyPreflightStep(config: EnvConfig): pipelines.CodeBuildStep {
    const fn = `${resourcePrefix(config)}api`;
    return new pipelines.CodeBuildStep(`ConcurrencyPreflight-${config.envName}`, {
      env: { FUNCTION_NAME: fn, WANT: String(config.api.reservedConcurrency), TRIGGER_NAME: `${resourcePrefix(config)}presignup`, TRIGGER_WANT: String(config.auth.preSignUp.reservedConcurrency), SEED_NAME: `${resourcePrefix(config)}seed`, SEED_WANT: String(config.seed.reservedConcurrency), MIN_UNRESERVED: String(MIN_UNRESERVED_CONCURRENCY) },
      commands: [
        // POSIX sh only: CodeBuild runs these commands with /bin/sh.
        'LIMIT="$(aws lambda get-account-settings --query AccountLimit.ConcurrentExecutions --output text)"',
        'UNRESERVED="$(aws lambda get-account-settings --query AccountLimit.UnreservedConcurrentExecutions --output text)"',
        // The function's current reservation (none before its first deploy) is already outside UNRESERVED.
        'CURRENT="$(aws lambda get-function-concurrency --function-name "$FUNCTION_NAME" --query ReservedConcurrentExecutions --output text 2>/dev/null || true)"',
        'case "$CURRENT" in ""|None) CURRENT=0;; esac',
        'TRIGGER_CURRENT="$(aws lambda get-function-concurrency --function-name "$TRIGGER_NAME" --query ReservedConcurrentExecutions --output text 2>/dev/null || true)"',
        'case "$TRIGGER_CURRENT" in ""|None) TRIGGER_CURRENT=0;; esac',
        'SEED_CURRENT="$(aws lambda get-function-concurrency --function-name "$SEED_NAME" --query ReservedConcurrentExecutions --output text 2>/dev/null || true)"',
        'case "$SEED_CURRENT" in ""|None) SEED_CURRENT=0;; esac',
        'AFTER=$((UNRESERVED + CURRENT + TRIGGER_CURRENT + SEED_CURRENT - WANT - TRIGGER_WANT - SEED_WANT))',
        'echo "Lambda concurrency: limit $LIMIT, unreserved $UNRESERVED; $FUNCTION_NAME reserves $CURRENT now, $WANT after this release; unreserved after: $AFTER (minimum $MIN_UNRESERVED)"',
        'if [ "$AFTER" -lt "$MIN_UNRESERVED" ]; then echo "PREFLIGHT FAIL: raise the Lambda concurrent executions quota (Service Quotas, L-B99A9384) or lower api.reservedConcurrency; nothing has been deployed." >&2; exit 1; fi',
      ],
      rolePolicyStatements: [
        // GetAccountSettings has no resource-level permissions (read-only, account quota only).
        new iam.PolicyStatement({ actions: ['lambda:GetAccountSettings'], resources: ['*'] }),
        new iam.PolicyStatement({
          actions: ['lambda:GetFunctionConcurrency'],
          resources: [fn, `${resourcePrefix(config)}presignup`, `${resourcePrefix(config)}seed`].map((name) => this.formatArn({ service: 'lambda', resource: 'function', resourceName: name, arnFormat: ArnFormat.COLON_RESOURCE_NAME })),
        }),
      ],
    });
  }

  /** Dev bootstrap after migrations and app deployment. No production automatic path exists. */
  private seedStep(stage: TherapyServiceHoursStage, config: EnvConfig): pipelines.CodeBuildStep {
    if (config.envName !== 'dev' || !config.seed.adminEmail || !stage.appStack.seed.operatorArnOutput) {
      throw new Error('Automatic seeding requires the dev environment, owner admin email and scoped operator role');
    }
    const prefix = resourcePrefix(config);
    const operatorArn = this.formatArn({ service: 'iam', region: '', resource: 'role', resourceName: `${prefix}seed-operator` });
    const runner = new iam.Role(this, 'DevSeedRunner', { roleName: `${prefix}seed-runner`, assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com') });
    runner.addToPolicy(new iam.PolicyStatement({ actions: ['sts:AssumeRole'], resources: [operatorArn] }));
    const auth = stage.dataStack.auth;
    const outputs: Record<string, CfnOutput> = { SEED_FUNCTION_NAME: stage.appStack.seed.nameOutput, SEED_OPERATOR_ROLE_ARN: stage.appStack.seed.operatorArnOutput };
    if (auth) {
      if (!auth.testClientIdOutput || !auth.testSecretArnOutput) throw new Error('Dev auth seed requires its password test client and generated credentials');
      outputs.USER_POOL_ID = auth.userPoolIdOutput;
      outputs.TEST_CLIENT_ID = auth.testClientIdOutput;
      outputs.TEST_CREDENTIALS_ARN = auth.testSecretArnOutput;
    }
    return new pipelines.CodeBuildStep('Seed-dev', {
      input: this.sources.infra, role: runner, envFromCfnOutputs: outputs,
      env: { APP_ENV: 'dev', ADMIN_EMAIL: config.seed.adminEmail, INCLUDE_DEV_USERS: String(config.seed.includeDevUsers), AUTH_ENABLED: String(config.auth.enabled) },
      commands: ['python3 scripts/seed_dev.py'], timeout: Duration.minutes(5),
    });
  }

  /** Invokes the environment's migrate Lambda synchronously and fails unless it reports "ok" (ADR-0003). */
  private migrateStep(stage: TherapyServiceHoursStage, config: EnvConfig): pipelines.CodeBuildStep {
    const name = `${resourcePrefix(config)}migrate`;
    return new pipelines.CodeBuildStep(`Migrate-${config.envName}`, {
      envFromCfnOutputs: { FUNCTION_NAME: stage.dataStack.migrateFunctionOutput },
      commands: [
        'aws lambda invoke --function-name "$FUNCTION_NAME" --cli-read-timeout 900 --cli-binary-format raw-in-base64-out --payload "{}" result.json',
        'cat result.json',
        'test "$(jq -r .status result.json)" = ok',
      ],
      timeout: Duration.minutes(20),
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [this.formatArn({ service: 'lambda', resource: 'function', resourceName: name, arnFormat: ArnFormat.COLON_RESOURCE_NAME })],
        }),
      ],
    });
  }

  /**
   * Uploads the frontend build to the SPA bucket: hashed assets as immutable for a year first, then
   * index.html as no-cache, then invalidates /index.html only (ADR-0004, ARC-42).
   */
  private frontendSyncStep(stage: TherapyServiceHoursStage, config: EnvConfig): pipelines.CodeBuildStep {
    const bucketPattern = `arn:${Aws.PARTITION}:s3:::${resourcePrefix(config)}web-*`;
    return new pipelines.CodeBuildStep(`FrontendSync-${config.envName}`, {
      input: this.frontendBuild,
      envFromCfnOutputs: { BUCKET: stage.webStack.bucketNameOutput, DISTRIBUTION_ID: stage.webStack.distributionIdOutput },
      commands: [
        'aws s3 sync . "s3://$BUCKET" --delete --exclude index.html --cache-control "public, max-age=31536000, immutable"',
        'aws s3 cp index.html "s3://$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html; charset=utf-8"',
        'aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths /index.html',
      ],
      rolePolicyStatements: [
        new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [bucketPattern] }),
        new iam.PolicyStatement({ actions: ['s3:PutObject', 's3:DeleteObject'], resources: [`${bucketPattern}/*`] }),
        // Distribution IDs are generated at deploy time; the action itself is low-risk.
        new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation'], resources: [this.formatArn({ service: 'cloudfront', region: '', resource: 'distribution', resourceName: '*' })] }),
      ],
    });
  }

  /**
   * Smoke test of the environment's CloudFront URL; a failure stops the run, so a broken dev never
   * reaches the prod approval. First scripts/smoke.sh (curl, quick to diagnose), then the frontend's
   * Playwright spec (S0-20): a real browser loads the SPA, and the security headers are asserted by
   * name and value. The spec comes from the same frontend commit that was just deployed.
   */
  private smokeStep(stage: TherapyServiceHoursStage, config: EnvConfig): pipelines.CodeBuildStep {
    return new pipelines.CodeBuildStep(`Smoke-${config.envName}`, {
      input: this.sources.infra,
      additionalInputs: { '../frontend': this.sources.frontend },
      partialBuildSpec: codebuild.BuildSpec.fromObject({ phases: { install: { 'runtime-versions': { nodejs: '22' } } } }),
      envFromCfnOutputs: { URL: stage.webStack.urlOutput },
      commands: [
        'bash scripts/smoke.sh "$URL"',
        'cd ../frontend',
        'npm ci',
        'npx playwright install --with-deps chromium',
        'SMOKE_URL="$URL" npm run e2e',
      ],
      timeout: Duration.minutes(20),
    });
  }

  /**
   * Takes a manual RDS snapshot of the environment's database before its data stack and migrations
   * change anything (ADR-0003, ARC-35), waits until it is available, and keeps the newest three
   * pre-release snapshots. On the very first deploy there is no instance yet, so it skips.
   */
  private snapshotStep(config: EnvConfig): pipelines.CodeBuildStep {
    const instance = `${resourcePrefix(config)}postgres`;
    const snapshotPrefix = `${resourcePrefix(config)}pre-release-`;
    const arn = (resource: string, name: string) =>
      this.formatArn({ service: 'rds', resource, resourceName: name, arnFormat: ArnFormat.COLON_RESOURCE_NAME });
    return new pipelines.CodeBuildStep(`Snapshot-${config.envName}`, {
      env: { INSTANCE: instance, SNAPSHOT_PREFIX: snapshotPrefix },
      commands: [
        'if ! aws rds describe-db-instances --db-instance-identifier "$INSTANCE" >/dev/null 2>&1; then echo "No instance $INSTANCE yet (first deploy): no snapshot needed"; exit 0; fi',
        'SNAPSHOT="${SNAPSHOT_PREFIX}$(date -u +%Y%m%d-%H%M%S)"',
        'aws rds create-db-snapshot --db-instance-identifier "$INSTANCE" --db-snapshot-identifier "$SNAPSHOT"',
        'aws rds wait db-snapshot-available --db-snapshot-identifier "$SNAPSHOT"',
        'echo "Snapshot $SNAPSHOT is available"',
        // Keep the newest three pre-release snapshots (storage cost); automated backups are separate.
        'aws rds describe-db-snapshots --db-instance-identifier "$INSTANCE" --snapshot-type manual --query "DBSnapshots[].[SnapshotCreateTime,DBSnapshotIdentifier]" --output text | grep -F "$SNAPSHOT_PREFIX" | sort -r | tail -n +4 | cut -f2 | xargs -r -n1 aws rds delete-db-snapshot --db-snapshot-identifier',
      ],
      timeout: Duration.minutes(60),
      rolePolicyStatements: [
        new iam.PolicyStatement({ actions: ['rds:DescribeDBInstances', 'rds:CreateDBSnapshot'], resources: [arn('db', instance)] }),
        new iam.PolicyStatement({
          actions: ['rds:CreateDBSnapshot', 'rds:DescribeDBSnapshots', 'rds:DeleteDBSnapshot', 'rds:AddTagsToResource'],
          resources: [arn('snapshot', `${snapshotPrefix}*`)],
        }),
        // describe-db-snapshots filtered by instance is authorized against the instance as well.
        new iam.PolicyStatement({ actions: ['rds:DescribeDBSnapshots'], resources: [arn('db', instance)] }),
      ],
    });
  }
}
