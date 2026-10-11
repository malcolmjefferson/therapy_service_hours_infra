import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { BACKEND_LAMBDAS } from '../lib/pipeline/pipeline-stack';
import { buildStage } from './helpers';

describe.each([devConfig, prodConfig])('$envName invitation gate (ADR-0007/0009)', (config) => {
  test('deploys a single warmed arm64 IAM-authenticated connection before pool activation', () => {
    const stage = buildStage(config);
    const app = Template.fromStack(stage.appStack);
    app.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `therapy-service-hours-${config.envName}-presignup`,
      Runtime: 'provided.al2023', Architectures: ['arm64'], Handler: 'bootstrap',
      MemorySize: 128, Timeout: 5, ReservedConcurrentExecutions: 1,
      Environment: { Variables: Match.objectLike({ APP_ENV: config.envName, DB_USER: 'presignup_ro', DB_AUTH: 'iam' }) },
      VpcConfig: { SubnetIds: Match.anyValue(), SecurityGroupIds: Match.anyValue() },
    });
    app.hasResourceProperties('AWS::Lambda::Alias', { Name: 'live', ProvisionedConcurrencyConfig: { ProvisionedConcurrentExecutions: 1 } });
    app.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: `/aws/lambda/therapy-service-hours-${config.envName}-presignup`, RetentionInDays: config.logRetention });
    const policies = app.findResources('AWS::IAM::Policy');
    const triggerPolicy = Object.entries(policies).find(([id]) => id.startsWith('PreSignUpFunctionServiceRoleDefaultPolicy'))?.[1];
    expect(triggerPolicy).toBeDefined();
    const json = JSON.stringify(triggerPolicy);
    expect(json).toContain('rds-db:connect');
    expect(json).toContain('/presignup_ro');
    expect(json).not.toMatch(/secretsmanager:|cognito-idp:|\/app_rw|\/migrator/);
    expect(JSON.stringify(app.toJSON())).not.toContain('DB_PASSWORD');
    // The data stack's existing network tests assert no NAT, internet route or open ingress.
    app.hasResourceProperties('AWS::CloudWatch::Alarm', { AlarmName: `therapy-service-hours-${config.envName}-presignup-duration`, Threshold: 4000 });
    app.hasResourceProperties('AWS::CloudWatch::Alarm', { AlarmName: `therapy-service-hours-${config.envName}-presignup-errors` });
    app.hasResourceProperties('AWS::CloudWatch::Alarm', { AlarmName: `therapy-service-hours-${config.envName}-presignup-throttles` });
  });

  test('pool activation installs the qualified alias and only pool-scoped invocation permission without a cycle', () => {
    const stage = buildStage({ ...config, auth: { ...config.auth, enabled: true } });
    expect(() => stage.synth()).not.toThrow();
    const data = Template.fromStack(stage.dataStack);
    const app = Template.fromStack(stage.appStack);
    data.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: { PreSignUp: { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, `:lambda:us-west-2:123456789012:function:therapy-service-hours-${config.envName}-presignup:live`]] } },
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
    app.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction', Principal: 'cognito-idp.amazonaws.com', SourceAccount: '123456789012',
      FunctionName: { Ref: Match.stringLikeRegexp('PreSignUpLive') },
      SourceArn: { 'Fn::ImportValue': Match.stringLikeRegexp('AuthPool') },
    });
    expect(stage.dataStack.dependencies).not.toContain(stage.appStack);
    expect(JSON.stringify(data.toJSON())).not.toContain(`${config.envName}-App`);
    data.resourceCountIs('AWS::Lambda::Alias', 0);
  });
});

test('pipeline builds the trigger binary after the backend release prerequisite', () => {
  expect(BACKEND_LAMBDAS).toContain('presignup');
});

test.each([
  { memoryMiB: 64 }, { memoryMiB: 512 }, { provisionedConcurrency: 0 }, { reservedConcurrency: 0 }, { reservedConcurrency: 2 },
])('rejects unapproved invitation gate sizing %j', (override) => {
  expect(() => buildStage({ ...devConfig, auth: { ...devConfig.auth, preSignUp: { ...devConfig.auth.preSignUp, ...override } } })).toThrow(/ADR-0007/);
});
