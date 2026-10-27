import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { BACKEND_LAMBDAS } from '../lib/pipeline/pipeline-stack';
import { buildStage } from './helpers';

describe.each([devConfig, prodConfig])('$envName idempotency-key purge (S2-09)', (config) => {
  const name = `therapy-service-hours-${config.envName}-idempotency-purge`;

  test('is an isolated-VPC arm64 Lambda that connects as app_rw over IAM', () => {
    const app = Template.fromStack(buildStage(config).appStack);
    app.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: name, Runtime: 'provided.al2023', Architectures: ['arm64'], Handler: 'bootstrap',
      MemorySize: 128, Timeout: 60,
      VpcConfig: { SubnetIds: Match.anyValue(), SecurityGroupIds: Match.anyValue() },
      Environment: { Variables: Match.objectLike({ APP_ENV: config.envName, DB_USER: 'app_rw', DB_AUTH: 'iam', DB_NAME: Match.anyValue() }) },
    });
    app.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: `/aws/lambda/${name}`, RetentionInDays: config.logRetention });
    expect(JSON.stringify(app.toJSON())).not.toContain('DB_PASSWORD');
  });

  test('may only connect to the database as app_rw and holds no other permission', () => {
    const app = Template.fromStack(buildStage(config).appStack);
    const policies = app.findResources('AWS::IAM::Policy');
    const policy = Object.entries(policies).find(([id]) => id.startsWith('IdempotencyPurgeFunctionServiceRoleDefaultPolicy'))?.[1];
    expect(policy).toBeDefined();
    const json = JSON.stringify(policy);
    expect(json).toContain('rds-db:connect');
    expect(json).toContain('/app_rw');
    expect(json).not.toMatch(/secretsmanager:|cognito-idp:|\/migrator|\/presignup_ro/);
  });

  test('runs once a day and the failure alarm covers a one-day period', () => {
    const app = Template.fromStack(buildStage(config).appStack);
    app.hasResourceProperties('AWS::Events::Rule', {
      Name: `${name}-daily`, ScheduleExpression: 'cron(30 10 * * ? *)', State: 'ENABLED',
      Targets: [Match.objectLike({ RetryPolicy: { MaximumRetryAttempts: 1, MaximumEventAgeInSeconds: 3600 } })],
    });
    app.hasResourceProperties('AWS::Lambda::Permission', { Action: 'lambda:InvokeFunction', Principal: 'events.amazonaws.com' });
    app.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: `${name}-errors`, MetricName: 'Errors', Period: 86400, Statistic: 'Sum', Threshold: 1, TreatMissingData: 'notBreaching',
    });
  });

  test('has no reserved concurrency, so the concurrency preflight is unchanged', () => {
    const app = Template.fromStack(buildStage(config).appStack);
    const fn = Object.values(app.findResources('AWS::Lambda::Function')).find((r) => r.Properties.FunctionName === name);
    expect(fn?.Properties).not.toHaveProperty('ReservedConcurrentExecutions');
  });
});

test('the pipeline builds and ships the purge binary', () => {
  expect(BACKEND_LAMBDAS).toContain('idempotency-purge');
});
