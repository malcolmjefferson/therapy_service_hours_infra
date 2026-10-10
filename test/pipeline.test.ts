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

  test('dev deploys data, then app, then web', () => {
    const dev = stages(pipelineTemplate()).find((s) => s.Name === 'Dev');
    const deploys = (dev?.Actions ?? []).filter((a) => a.Name.endsWith('.Deploy')).map((a) => a.Name);
    expect(deploys).toEqual(['therapy-service-hours-dev-data.Deploy', 'therapy-service-hours-dev-app.Deploy', 'therapy-service-hours-dev-web.Deploy']);
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
