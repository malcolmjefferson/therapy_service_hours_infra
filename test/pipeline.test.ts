import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { App } from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';
import { placeholderArtifacts } from '../lib/artifacts';
import { DOCS_ONLY_PATHS, PipelineStack, REPOSITORIES } from '../lib/pipeline/pipeline-stack';

// Most tests cover the full pipeline with prod on (the M3 configuration); the deployProd: false
// tests cover the current one (RELEASE.deployProd).
function pipelineTemplate({ deployProd = true }: { deployProd?: boolean } = {}): Template {
  const stack = new PipelineStack(new App(), 'Pipeline', {
    env: { account: PLACEHOLDER_ACCOUNT, region: 'us-west-2' },
    account: PLACEHOLDER_ACCOUNT,
    artifacts: placeholderArtifacts(),
    notificationEmail: 'malcolmj0415@gmail.com',
    deployProd,
    monthlyBudgetUsd: 50,
  });
  return Template.fromStack(stack);
}

type Stage = { Name: string; Actions: { Name: string; ActionTypeId: { Category: string }; Configuration?: Record<string, unknown> }[] };

function stages(t: Template): Stage[] {
  const p = Object.values(t.findResources('AWS::CodePipeline::Pipeline'))[0] as { Properties: { Stages: Stage[]; PipelineType: string; ExecutionMode: string } };
  return p.Properties.Stages;
}

function buildSpecs(t: Template): string {
  return JSON.stringify(t.findResources('AWS::CodeBuild::Project'));
}

describe('release pipeline (S0-14, ADR-0005)', () => {
  test('backend builds future command artifacts before infra can self-mutate to consume them', () => {
    const projects = Object.values(pipelineTemplate().findResources('AWS::CodeBuild::Project')) as { Properties: { Source: { BuildSpec: string } } }[];
    const specs = projects.map((p) => JSON.parse(p.Properties.Source.BuildSpec));
    const commands = specs.map((s) => s.phases?.build?.commands as string[]).find((c) => c?.includes('go version'));
    const build = commands?.find((c) => c.includes('GOARCH=arm64 go build'));
    expect(build).toBeDefined();
    const root = mkdtempSync(join(tmpdir(), 'backend-build-test-'));
    const bash = process.platform === 'win32' ? resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '../../../bin/bash.exe') : 'bash';
    try {
      mkdirSync(join(root, 'cmd/api'), { recursive: true });
      mkdirSync(join(root, 'cmd/future-seed'), { recursive: true });
      writeFileSync(join(root, 'cmd/README'), 'not a command');
      mkdirSync(join(root, 'fake-bin'));
      writeFileSync(join(root, 'fake-bin/go'), '#!/bin/sh\nprintf "%s\\n" "$@" >> "$GO_ARGS_LOG"\ncase "$*" in *./cmd/broken*) exit 9 ;; esac\n', { mode: 0o755 });
      const log = join(root, 'go-args');
      const env = { ...process.env, PATH: `${join(root, 'fake-bin')}${delimiter}${process.env.PATH}`, GO_ARGS_LOG: log };
      execFileSync(bash, ['-c', build!], { cwd: root, env });
      expect(readFileSync(log, 'utf8')).toContain('dist/future-seed/bootstrap\n./cmd/future-seed');
      expect(readFileSync(log, 'utf8')).not.toContain('README');
      writeFileSync(log, '');
      mkdirSync(join(root, 'cmd/broken'));
      expect(() => execFileSync(bash, ['-c', build!], { cwd: root, env })).toThrow();
      expect(readFileSync(log, 'utf8')).not.toContain('./cmd/future-seed');
    } finally {
      // Only remove the task-owned temporary fixture, never a checkout or caller-supplied path.
      if (resolve(root).startsWith(resolve(tmpdir()) + '/')) rmSync(root, { recursive: true, force: true });
      else if (process.platform === 'win32' && resolve(root).startsWith(resolve(tmpdir()) + '\\')) rmSync(root, { recursive: true, force: true });
    }
  });
  test('CodePipeline V2 in QUEUED mode, so a pending approval is never superseded', () => {
    pipelineTemplate().hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'therapy-service-hours',
      PipelineType: 'V2',
      ExecutionMode: 'QUEUED',
    });
  });

  test('three GitHub sources on main through one CodeConnections connection', () => {
    const t = pipelineTemplate();
    t.resourceCountIs('AWS::CodeConnections::Connection', 1);
    t.hasResourceProperties('AWS::CodeConnections::Connection', { ProviderType: 'GitHub' });
    const source = stages(t).find((s) => s.Name === 'Source');
    const repos = (source?.Actions ?? []).map((a) => a.Configuration?.FullRepositoryId).sort();
    expect(repos).toEqual(Object.values(REPOSITORIES).sort());
    for (const a of source?.Actions ?? []) {
      expect(a.Configuration).toMatchObject({ BranchName: 'main', DetectChanges: false });
    }
  });

  test('each source starts runs only from pushes to main that change more than docs', () => {
    const t = pipelineTemplate();
    const names = (stages(t).find((s) => s.Name === 'Source')?.Actions ?? []).map((a) => a.Name).sort();
    const pipeline = Object.values(t.findResources('AWS::CodePipeline::Pipeline'))[0] as {
      Properties: { Triggers: { ProviderType: string; GitConfiguration: { SourceActionName: string; Push: { Branches: { Includes: string[] }; FilePaths: { Excludes: string[] } }[] } }[] };
    };
    const triggers = pipeline.Properties.Triggers;
    expect(triggers.map((x) => x.GitConfiguration.SourceActionName).sort()).toEqual(names);
    for (const x of triggers) {
      expect(x.ProviderType).toBe('CodeStarSourceConnection');
      expect(x.GitConfiguration.Push).toEqual([{ Branches: { Includes: ['main'] }, FilePaths: { Excludes: DOCS_ONLY_PATHS } }]);
    }
  });

  test('build logs go to one group with 14-day retention, and builds time out after 30 minutes', () => {
    const t = pipelineTemplate();
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/therapy-service-hours/pipeline/codebuild', RetentionInDays: 14 });
    const projects = Object.values(t.findResources('AWS::CodeBuild::Project')) as { Properties: { TimeoutInMinutes?: number; LogsConfig?: { CloudWatchLogs?: { GroupName?: unknown } } } }[];
    expect(projects.length).toBeGreaterThan(0);
    for (const p of projects) {
      expect(p.Properties.TimeoutInMinutes).toBeLessThanOrEqual(60);
      expect(p.Properties.LogsConfig?.CloudWatchLogs?.GroupName).toBeDefined();
    }
    const defaulted = projects.filter((p) => p.Properties.TimeoutInMinutes === 30);
    expect(defaulted.length).toBeGreaterThan(0);
  });

  test('build, self-mutate, publish assets, dev, then prod, in that order', () => {
    expect(stages(pipelineTemplate()).map((s) => s.Name)).toEqual(['Source', 'Build', 'UpdatePipeline', 'Assets', 'Dev', 'Prod']);
  });

  test('prod (S0-16): release info, manual approval, snapshot, data, migrate, app, web, sync, smoke', () => {
    const prod = stages(pipelineTemplate()).find((s) => s.Name === 'Prod');
    const ordered = [...(prod?.Actions ?? [])]
      .sort((x, y) => ((x as { RunOrder?: number }).RunOrder ?? 0) - ((y as { RunOrder?: number }).RunOrder ?? 0))
      .map((a) => a.Name)
      .filter((n) => !n.endsWith('.Prepare'));
    expect(ordered).toEqual([
      'ReleaseInfo',
      'PromoteToProd',
      'therapy-service-hours-prod-data.ConcurrencyPreflight-prod',
      'therapy-service-hours-prod-data.Snapshot-prod',
      'therapy-service-hours-prod-data.Deploy',
      'therapy-service-hours-prod-data.Migrate-prod',
      'therapy-service-hours-prod-app.Deploy',
      'therapy-service-hours-prod-web.Deploy',
      'therapy-service-hours-prod-web.FrontendSync-prod',
      'Smoke-prod',
    ]);
    const approval = prod?.Actions.find((a) => a.Name === 'PromoteToProd');
    expect(approval?.ActionTypeId.Category).toBe('Approval');
  });

  test('the approval is preceded by a step printing all three commit SHAs', () => {
    const specs = buildSpecs(pipelineTemplate());
    expect(specs).toContain('Release candidate: infra $INFRA_COMMIT, backend $BACKEND_COMMIT, frontend $FRONTEND_COMMIT');
  });

  test('the prod snapshot waits until available, skips the first deploy, and keeps the newest three', () => {
    const t = pipelineTemplate();
    const specs = buildSpecs(t);
    expect(specs).toContain('aws rds create-db-snapshot');
    expect(specs).toContain('aws rds wait db-snapshot-available');
    expect(specs).toContain('first deploy');
    expect(specs).toContain('tail -n +4');
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain(':db:therapy-service-hours-prod-postgres');
    expect(policies).toContain(':snapshot:therapy-service-hours-prod-pre-release-*');
    expect(policies).not.toMatch(/"rds:[A-Za-z]+","Resource":"\*"/);
  });

  test('prod uses the same Lambda code assets as dev (same assembly, promoted not rebuilt)', () => {
    const specs = buildSpecs(pipelineTemplate());
    // One backend build per run, and each asset is published once: prod's assets have the same content
    // hashes as dev's, so the zips prod deploys are byte-for-byte the ones dev tested.
    expect((specs.match(/go build/g) ?? []).length).toBe(1);
    const published = specs.match(/cdk-assets --path [^ ]+ --verbose publish [^ ]+/g) ?? [];
    expect(published.length).toBeGreaterThan(0);
    expect(new Set(published).size).toBe(published.length);
    expect(specs).not.toContain('assembly-Pipeline-Prod/');
  });

  test('backend, frontend and synth builds run every gate and fail fast', () => {
    const specs = buildSpecs(pipelineTemplate());
    for (const cmd of [
      'go vet ./...',
      'go test ./...',
      'GOOS=linux GOARCH=arm64',
      'npm run lint',
      'npm run typecheck',
      'npm run format:check',
      'npm run api:drift -- --backend-spec ../backend/api/openapi.yaml',
      'npx cdk synth',
    ]) {
      expect(specs).toContain(cmd);
    }
    // Dependency audits run in GitHub Actions (PRs and weekly), never as a release gate.
    expect(specs).not.toContain('npm audit');
  });

  test('dev: data, migrate, app, web, frontend sync, then smoke (ADR-0003, S0-15)', () => {
    const dev = stages(pipelineTemplate()).find((s) => s.Name === 'Dev');
    const ordered = [...(dev?.Actions ?? [])]
      .sort((x, y) => ((x as { RunOrder?: number }).RunOrder ?? 0) - ((y as { RunOrder?: number }).RunOrder ?? 0))
      .map((a) => a.Name)
      .filter((n) => !n.endsWith('.Prepare'));
    expect(ordered).toEqual([
      'therapy-service-hours-dev-data.ConcurrencyPreflight-dev',
      'therapy-service-hours-dev-data.Deploy',
      'therapy-service-hours-dev-data.Migrate-dev',
      'therapy-service-hours-dev-app.Deploy',
      'therapy-service-hours-dev-app.Seed-dev',
      'therapy-service-hours-dev-web.Deploy',
      'therapy-service-hours-dev-web.FrontendSync-dev',
      'Smoke-dev',
    ]);
  });

  test('the migrate step invokes only the dev migrate Lambda and fails unless it reports ok', () => {
    const t = pipelineTemplate();
    const specs = buildSpecs(t);
    expect(specs).toContain('aws lambda invoke --function-name');
    expect(specs).toContain('jq -r .status result.json');
    expect(specs).toContain('result.json)');
    expect(specs).toContain(' = ok');
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('function:therapy-service-hours-dev-migrate');
    expect(policies).not.toMatch(/"lambda:InvokeFunction","Resource":"\*"/);
  });

  test('the frontend sync uploads immutable assets, then a no-cache index.html, then invalidates it', () => {
    const specs = buildSpecs(pipelineTemplate());
    const sync = specs.indexOf('aws s3 sync . ');
    const index = specs.indexOf('aws s3 cp index.html');
    const invalidate = specs.indexOf('aws cloudfront create-invalidation');
    expect(sync).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(sync);
    expect(invalidate).toBeGreaterThan(index);
    expect(specs).toContain('public, max-age=31536000, immutable');
    expect(specs).toContain('--exclude index.html');
    expect(specs).toContain('--paths /index.html');
    const policies = JSON.stringify(pipelineTemplate().findResources('AWS::IAM::Policy'));
    expect(policies).toContain(':s3:::therapy-service-hours-dev-web-*/*');
  });

  test('the smoke step runs scripts/smoke.sh, then the Playwright spec against the same URL (S0-20)', () => {
    const t = pipelineTemplate();
    const projects = Object.values(t.findResources('AWS::CodeBuild::Project')).map((p) => JSON.stringify(p));
    const smoke = projects.filter((p) => p.includes('bash scripts/smoke.sh'));
    expect(smoke).toHaveLength(2); // dev and prod
    for (const spec of smoke) {
      const curl = spec.indexOf('bash scripts/smoke.sh');
      const browsers = spec.indexOf('npx playwright install --with-deps chromium');
      const e2e = spec.indexOf('npm run e2e');
      expect(curl).toBeGreaterThan(-1);
      expect(browsers).toBeGreaterThan(curl);
      expect(e2e).toBeGreaterThan(browsers);
      expect(spec).toContain('SMOKE_URL=');
    }
    // The spec comes from the frontend source of the same execution.
    const devSmoke = stages(t)
      .find((s) => s.Name === 'Dev')
      ?.Actions.find((a) => a.Name === 'Smoke-dev') as unknown as { InputArtifacts: { Name: string }[] };
    expect(devSmoke.InputArtifacts).toHaveLength(2);
    expect(JSON.stringify(devSmoke.InputArtifacts)).toContain('therapy_service_hours_frontend');
  });

  test('a concurrency preflight fails the release before the data stack if the api reservation cannot fit', () => {
    const t = pipelineTemplate();
    const projects = Object.values(t.findResources('AWS::CodeBuild::Project')).map((p) => JSON.stringify(p));
    const preflights = projects.filter((p) => p.includes('get-account-settings'));
    expect(preflights).toHaveLength(2); // dev and prod
    for (const spec of preflights) {
      expect(spec).toContain('UnreservedConcurrentExecutions');
      expect(spec).toContain('get-function-concurrency');
      expect(spec).toContain('PREFLIGHT FAIL');
      expect(spec).toContain('exit 1');
    }
    // Runs before anything changes: ahead of the data stack in dev, ahead of the snapshot in prod.
    const order = (stage: string) =>
      Object.fromEntries((stages(t).find((s) => s.Name === stage)?.Actions ?? []).map((a) => [a.Name, (a as { RunOrder?: number }).RunOrder ?? 0]));
    const dev = order('Dev');
    expect(dev['therapy-service-hours-dev-data.ConcurrencyPreflight-dev']).toBeLessThan(dev['therapy-service-hours-dev-data.Deploy']);
    const prod = order('Prod');
    expect(prod['therapy-service-hours-prod-data.ConcurrencyPreflight-prod']).toBeLessThan(prod['therapy-service-hours-prod-data.Snapshot-prod']);
    // Read-only permissions: the account setting, and only the env's own api function.
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('lambda:GetAccountSettings');
    expect(policies).toContain('function:therapy-service-hours-prod-api');
    expect(policies).not.toContain('lambda:PutFunctionConcurrency');
  });

  test('with prod deploys off (until M3), runs end after the dev smoke test: no approval, no prod stage', () => {
    const t = pipelineTemplate({ deployProd: false });
    const names = stages(t).map((s) => s.Name);
    expect(names).toContain('Dev');
    expect(names).not.toContain('Prod');
    const actions = stages(t).flatMap((s) => s.Actions);
    expect(actions.filter((a) => a.ActionTypeId.Category === 'Approval')).toHaveLength(0);
    expect(JSON.stringify(t.toJSON())).not.toContain('therapy-service-hours-prod-');
    // Dev is identical either way.
    const dev = (deployProd: boolean) => JSON.stringify(stages(pipelineTemplate({ deployProd })).find((s) => s.Name === 'Dev'));
    expect(dev(false)).toEqual(dev(true));
  });

  test('the account-wide $50 budget lives in the pipeline stack and alerts through its topic (SEC-82)', () => {
    for (const deployProd of [false, true]) {
      const t = pipelineTemplate({ deployProd });
      t.resourceCountIs('AWS::Budgets::Budget', 1);
      t.hasResourceProperties('AWS::Budgets::Budget', {
        Budget: { BudgetName: 'therapy-service-hours-monthly', BudgetType: 'COST', TimeUnit: 'MONTHLY', BudgetLimit: { Amount: 50, Unit: 'USD' } },
        NotificationsWithSubscribers: [
          Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 80 }), Subscribers: [Match.objectLike({ Address: { Ref: Match.stringLikeRegexp('Notifications') } })] }),
          Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 100 }) }),
          Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 100 }) }),
        ],
      });
      t.hasResourceProperties('AWS::SNS::TopicPolicy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Sid: 'AllowBudgets', Principal: { Service: 'budgets.amazonaws.com' }, Action: 'sns:Publish' })]) },
      });
    }
  });

  test('no customer-managed KMS key (crossAccountKeys off, budget guard)', () => {
    pipelineTemplate().resourceCountIs('AWS::KMS::Key', 0);
  });

  test('failures, successes and approvals notify the owner by email through EventBridge', () => {
    const t = pipelineTemplate();
    t.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'malcolmj0415@gmail.com' });
    // CodeStar Notifications rejected the topic at deploy time; EventBridge rules replace it.
    t.resourceCountIs('AWS::CodeStarNotifications::NotificationRule', 0);
    t.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['aws.codepipeline'],
        'detail-type': ['CodePipeline Pipeline Execution State Change'],
        detail: { state: ['FAILED', 'SUCCEEDED'] },
      },
      Targets: [{ Arn: { Ref: Match.stringLikeRegexp('Notifications') } }],
    });
    t.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        'detail-type': ['CodePipeline Action Execution State Change'],
        detail: { state: ['STARTED'], type: { category: ['Approval'] } },
      },
    });
    // EventBridge may publish to the topic.
    expect(JSON.stringify(t.findResources('AWS::SNS::TopicPolicy'))).toContain('events.amazonaws.com');
  });
});
