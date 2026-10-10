import { Aspects, Aws, CfnOutput, Stack, StackProps, Tags } from 'aws-cdk-lib/core';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codeconnections from 'aws-cdk-lib/aws-codeconnections';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { APP_NAME, devConfig } from '../../config';
import { TherapyServiceHoursStage } from '../app-stage';
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
export const BACKEND_LAMBDAS = ['api', 'migrate', 'dbbootstrap', 'dbbootstrap-provider'] as const;

/** Props for {@link PipelineStack}. */
export interface PipelineStackProps extends StackProps {
  /** The account every stage deploys to (resolved and checked by lib/account.ts). */
  readonly account: string;
  /** Lambda code for the stages (from BACKEND_DIST in the pipeline's synth step). */
  readonly artifacts: LambdaArtifacts;
  /** Owner email for pipeline failure and approval notifications. */
  readonly notificationEmail: string;
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
 * - Failures notify the owner through SNS.
 *
 * The connection is created PENDING; the owner authorizes it once in the console (an owner action).
 */
export class PipelineStack extends Stack {
  readonly pipeline: pipelines.CodePipeline;
  readonly frontendBuild: pipelines.CodeBuildStep;
  readonly sources: Record<keyof typeof REPOSITORIES, pipelines.CodePipelineSource>;
  readonly dev: TherapyServiceHoursStage;
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
        `for c in ${BACKEND_LAMBDAS.join(' ')}; do GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o "dist/$c/bootstrap" "./cmd/$c"; done`,
        'echo "$COMMIT_ID" > dist/VERSION',
      ],
      primaryOutputDirectory: 'dist',
    });

    this.frontendBuild = new pipelines.CodeBuildStep('Frontend', {
      input: this.sources.frontend,
      additionalInputs: { '../backend': this.sources.backend },
      partialBuildSpec: codebuild.BuildSpec.fromObject({ phases: { install: { 'runtime-versions': { nodejs: '22' } } } }),
      commands: [
        'npm ci',
        'npm audit --audit-level=high',
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
      commands: ['npm ci', 'npm audit --audit-level=high', 'npm run typecheck', 'npm test', 'npx cdk synth --quiet'],
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
    this.pipeline.addStage(this.dev);

    this.pipeline.buildPipeline();

    this.topic = new sns.Topic(this, 'Notifications', {
      topicName: `${APP_NAME}-pipeline`,
      displayName: 'Therapy Service Hours pipeline',
      enforceSSL: true,
    });
    this.topic.addSubscription(new subscriptions.EmailSubscription(props.notificationEmail));
    new notifications.NotificationRule(this, 'PipelineNotifications', {
      notificationRuleName: `${APP_NAME}-pipeline`,
      source: this.pipeline.pipeline,
      events: [
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-manual-approval-needed',
        'codepipeline-pipeline-pipeline-execution-succeeded',
      ],
      targets: [this.topic],
      detailType: notifications.DetailType.BASIC,
    });

    new CfnOutput(this, 'ConnectionArn', {
      description: 'Authorize this GitHub connection once in the console (Developer Tools > Connections)',
      value: connection.attrConnectionArn,
    });
  }
}
