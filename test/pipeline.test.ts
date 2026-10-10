import { describe, expect, test } from 'vitest';
import { App } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';
import { placeholderArtifacts } from '../lib/artifacts';
import { PipelineStack, REPOSITORIES } from '../lib/pipeline/pipeline-stack';

function pipelineTemplate(): Template {
  const stack = new PipelineStack(new App(), 'Pipeline', {
    env: { account: PLACEHOLDER_ACCOUNT, region: 'us-west-2' },
    account: PLACEHOLDER_ACCOUNT,
    artifacts: placeholderArtifacts(),
    notificationEmail: 'malcolmj0415@gmail.com',
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
      expect(a.Configuration).toMatchObject({ BranchName: 'main', DetectChanges: true });
    }
  });

  test('build, self-mutate, publish assets, then dev, in that order', () => {
    expect(stages(pipelineTemplate()).map((s) => s.Name)).toEqual(['Source', 'Build', 'UpdatePipeline', 'Assets', 'Dev']);
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
      'npm audit --audit-level=high',
      'npm run api:drift -- --backend-spec ../backend/api/openapi.yaml',
      'npx cdk synth',
    ]) {
      expect(specs).toContain(cmd);
    }
  });

  test('dev: data, migrate, app, web, frontend sync, then smoke (ADR-0003, S0-15)', () => {
    const dev = stages(pipelineTemplate()).find((s) => s.Name === 'Dev');
    const ordered = [...(dev?.Actions ?? [])]
      .sort((x, y) => ((x as { RunOrder?: number }).RunOrder ?? 0) - ((y as { RunOrder?: number }).RunOrder ?? 0))
      .map((a) => a.Name)
      .filter((n) => !n.endsWith('.Prepare'));
    expect(ordered).toEqual([
      'therapy-service-hours-dev-data.Deploy',
      'therapy-service-hours-dev-data.Migrate-dev',
      'therapy-service-hours-dev-app.Deploy',
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

  test('the smoke step runs scripts/smoke.sh against the dev URL', () => {
    expect(buildSpecs(pipelineTemplate())).toContain('bash scripts/smoke.sh');
  });

  test('no customer-managed KMS key (crossAccountKeys off, budget guard)', () => {
    pipelineTemplate().resourceCountIs('AWS::KMS::Key', 0);
  });

  test('failures and approvals notify the owner by email', () => {
    const t = pipelineTemplate();
    t.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'malcolmj0415@gmail.com' });
    t.hasResourceProperties('AWS::CodeStarNotifications::NotificationRule', {
      EventTypeIds: ['codepipeline-pipeline-pipeline-execution-failed', 'codepipeline-pipeline-manual-approval-needed', 'codepipeline-pipeline-pipeline-execution-succeeded'],
    });
  });
});
