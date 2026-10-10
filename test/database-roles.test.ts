import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { backendArtifacts, placeholderArtifacts, resolveArtifacts } from '../lib/artifacts';
import { buildStage } from './helpers';

function template(config = devConfig): Template {
  return Template.fromStack(buildStage(config).dataStack);
}

type Statement = { Effect?: string; Action: string | string[]; Resource: unknown };

function statementsOf(t: Template, roleNamePart: string): Statement[] {
  const roles = Object.entries(t.findResources('AWS::IAM::Role')).filter(([id]) => id.includes(roleNamePart)).map(([id]) => id);
  return Object.values(t.findResources('AWS::IAM::Policy'))
    .map((p) => (p as { Properties: { Roles: { Ref: string }[]; PolicyDocument: { Statement: Statement[] } } }).Properties)
    .filter((p) => p.Roles.some((r) => roles.includes(r.Ref)))
    .flatMap((p) => p.PolicyDocument.Statement);
}

describe('database role bootstrap (S0-08, ADR-0001 amendment)', () => {
  test('the custom resource carries no password, only the secret ARN and the worker name', () => {
    const t = template();
    t.hasResourceProperties('Custom::DatabaseRoles', {
      ServiceToken: { 'Fn::GetAtt': [Match.stringLikeRegexp('DatabaseRolesProvider'), 'Arn'] },
      MasterSecretArn: { 'Fn::GetAtt': [Match.anyValue(), 'MasterUserSecret.SecretArn'] },
      WorkerFunction: { Ref: Match.stringLikeRegexp('DatabaseRolesHandler') },
      Database: 'therapy_service_hours',
      Revision: '2',
    });
    const json = JSON.stringify(t.toJSON());
    expect(json).not.toMatch(/\{\{resolve:secretsmanager/);
    expect(json).not.toMatch(/MasterPassword|"Password"/);
  });

  test('the provider runs outside the VPC and may read only the master secret and invoke only the worker', () => {
    const t = template();
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'therapy-service-hours-dev-db-bootstrap-provider',
      Runtime: 'provided.al2023',
      Architectures: ['arm64'],
      VpcConfig: Match.absent(),
      Environment: Match.absent(),
    });
    // Allowed actions only; the Deny on logs:CreateLogGroup is checked in lambda-roles.test.ts.
    const statements = statementsOf(t, 'DatabaseRolesProvider').filter((s) => s.Effect !== 'Deny');
    const actions = statements.flatMap((s) => [s.Action].flat());
    expect(actions.sort()).toEqual(['lambda:InvokeFunction', 'secretsmanager:GetSecretValue']);
    const secretStatement = statements.find((s) => s.Action === 'secretsmanager:GetSecretValue');
    expect(JSON.stringify(secretStatement?.Resource)).toContain('MasterUserSecret.SecretArn');
    const invoke = JSON.stringify(statements.find((s) => [s.Action].flat().includes('lambda:InvokeFunction'))?.Resource);
    expect(invoke).toContain('DatabaseRolesHandler');
  });

  test('the worker runs in the VPC, reaches only PostgreSQL, and has no Secrets Manager access', () => {
    const t = template();
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'therapy-service-hours-dev-db-bootstrap',
      VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue(), SecurityGroupIds: Match.anyValue() }),
      Environment: Match.absent(),
    });
    // No inline (CIDR) egress at all; the only egress rule is 5432 to the database security group.
    const sgs = t.findResources('AWS::EC2::SecurityGroup', { Properties: { GroupName: 'therapy-service-hours-dev-db-bootstrap' } });
    const [sgId, sg] = Object.entries(sgs)[0] ?? [];
    const inline = (sg as { Properties: { SecurityGroupEgress?: { CidrIp?: string }[] } }).Properties.SecurityGroupEgress ?? [];
    expect(inline.every((r) => r.CidrIp === '255.255.255.255/32')).toBe(true);
    t.hasResourceProperties('AWS::EC2::SecurityGroupEgress', {
      GroupId: { 'Fn::GetAtt': [sgId, 'GroupId'] },
      IpProtocol: 'tcp',
      FromPort: 5432,
      ToPort: 5432,
    });
    const actions = statementsOf(t, 'DatabaseRolesHandler').flatMap((s) => [s.Action].flat());
    expect(actions.some((a) => a.startsWith('secretsmanager:'))).toBe(false);
  });

  test('only the provider role mentions Secrets Manager anywhere in the stack', () => {
    const t = template();
    const all = Object.values(t.findResources('AWS::IAM::Policy')).flatMap(
      (p) => (p as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties.PolicyDocument.Statement,
    );
    const secretStatements = all.filter((s) => [s.Action].flat().some((a) => a.startsWith('secretsmanager:')));
    expect(secretStatements).toHaveLength(1);
    expect(statementsOf(t, 'DatabaseRolesProvider')).toContainEqual(secretStatements[0]);
  });

  test('both functions keep logs for the environment retention', () => {
    const t = template();
    for (const name of ['db-bootstrap', 'db-bootstrap-provider']) {
      t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: `/aws/lambda/therapy-service-hours-dev-${name}`, RetentionInDays: 14 });
    }
  });

  test('dev deletes automated backups with the instance; prod keeps them (ARC-35)', () => {
    template(devConfig).hasResourceProperties('AWS::RDS::DBInstance', { DeleteAutomatedBackups: true });
    template(prodConfig).hasResourceProperties('AWS::RDS::DBInstance', { DeleteAutomatedBackups: false });
  });
});

describe('Lambda artifacts', () => {
  test('credential-less synth uses the placeholder', () => {
    expect(resolveArtifacts(undefined, false).placeholder).toBe(true);
    expect(resolveArtifacts('  ', false).placeholder).toBe(true);
  });

  test('with credentials active, a missing BACKEND_DIST is refused so a placeholder can never deploy', () => {
    expect(() => resolveArtifacts(undefined, true)).toThrow(/BACKEND_DIST is not set/);
  });

  test('BACKEND_DIST must contain <name>/bootstrap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'backend-dist-'));
    mkdirSync(join(dir, 'dbbootstrap'));
    writeFileSync(join(dir, 'dbbootstrap', 'bootstrap'), 'binary');
    const artifacts = backendArtifacts(dir);
    expect(artifacts.placeholder).toBe(false);
    expect(() => artifacts.code('dbbootstrap')).not.toThrow();
    expect(() => artifacts.code('dbbootstrap-provider')).toThrow(/no dbbootstrap-provider\/bootstrap/);
  });

  test('the placeholder is flagged', () => {
    expect(placeholderArtifacts().placeholder).toBe(true);
  });
});
