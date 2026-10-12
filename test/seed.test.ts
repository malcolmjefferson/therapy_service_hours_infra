import { expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { buildStage } from './helpers';

test.each([devConfig, prodConfig])('seed %s has isolated IAM DML connection and bounded concurrency', (config) => {
  const stage = buildStage(config);
  const app = Template.fromStack(stage.appStack);
  app.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: `therapy-service-hours-${config.envName}-seed`, Architectures: ['arm64'], MemorySize: 128, Timeout: 60, ReservedConcurrentExecutions: 1,
    VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue() }),
    Environment: { Variables: Match.objectLike({ APP_ENV: config.envName, DB_USER: 'app_rw', DB_AUTH: 'iam' }) },
  });
  const seedRole = Object.entries(app.findResources('AWS::IAM::Role')).find(([id]) => id.startsWith('SeedFunctionServiceRole'))?.[0];
  expect(seedRole).toBeDefined();
  const policies = Object.values(app.findResources('AWS::IAM::Policy')) as { Properties: { Roles: unknown[]; PolicyDocument: { Statement: unknown[] } } }[];
  const seedPolicy = policies.find((p) => JSON.stringify(p.Properties.Roles).includes(seedRole!));
  expect(JSON.stringify(seedPolicy)).toContain('/app_rw');
  expect(JSON.stringify(seedPolicy)).not.toContain('secretsmanager:');
  expect(JSON.stringify(seedPolicy)).not.toContain('cognito-idp:');
});

test('enabled dev has generated credentials and an operator scoped to the pool and secret', () => {
  const stage = buildStage({ ...devConfig, auth: { ...devConfig.auth, enabled: true } });
  expect(() => stage.synth()).not.toThrow();
  const data = Template.fromStack(stage.dataStack);
  const app = Template.fromStack(stage.appStack);
  data.hasResourceProperties('AWS::SecretsManager::Secret', { Name: 'therapy-service-hours-dev-auth-test-users', GenerateSecretString: { SecretStringTemplate: '{}', GenerateStringKey: 'password', PasswordLength: 32, RequireEachIncludedType: true } });
  app.hasResourceProperties('AWS::IAM::Role', { RoleName: 'therapy-service-hours-dev-seed-operator', AssumeRolePolicyDocument: Match.objectLike({ Statement: Match.arrayWith([Match.objectLike({ Condition: { ArnEquals: { 'aws:PrincipalArn': Match.anyValue() } } })]) }) });
  const operator = Object.values(app.findResources('AWS::IAM::Role')).find((r) => r.Properties.RoleName === 'therapy-service-hours-dev-seed-operator');
  expect(JSON.stringify(operator)).toContain('role/therapy-service-hours-dev-seed-runner');
  const policies = Object.values(app.findResources('AWS::IAM::Policy')) as { Properties: { PolicyDocument: { Statement: { Action: string | string[]; Resource: unknown }[] } } }[];
  const actions = policies.flatMap((p) => p.Properties.PolicyDocument.Statement).filter((s) => JSON.stringify(s.Action).includes('cognito-idp:'));
  expect(actions).toHaveLength(1);
  expect(JSON.stringify(actions[0].Resource)).toContain('Fn::ImportValue');
  expect(JSON.stringify(actions[0].Resource)).not.toContain('*');
  expect(stage.dataStack.dependencies).not.toContain(stage.appStack);
});

test('prod forbids automatic seed and dev fixtures and has no test credentials', () => {
  const stage = buildStage({ ...prodConfig, auth: { ...prodConfig.auth, enabled: true } });
  const data = Template.fromStack(stage.dataStack);
  const secrets = JSON.stringify(data.findResources('AWS::SecretsManager::Secret'));
  expect(secrets).not.toContain('auth-test-users');
  const roles = JSON.stringify(Template.fromStack(stage.appStack).findResources('AWS::IAM::Role'));
  expect(roles).not.toContain('seed-operator');
  for (const settings of [{ includeDevUsers: true }, { onDeploy: true }]) {
    expect(() => buildStage({ ...prodConfig, seed: { ...prodConfig.seed, ...settings } })).toThrow(/prod forbids/);
  }
});
