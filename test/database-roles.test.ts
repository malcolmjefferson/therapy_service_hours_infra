import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig } from '../config';
import { backendArtifacts, placeholderArtifacts, resolveArtifacts } from '../lib/artifacts';
import { buildStage } from './helpers';

function template(): Template {
  return Template.fromStack(buildStage(devConfig).dataStack);
}

describe('database role bootstrap (S0-08, ADR-0001)', () => {
  test('a Custom::DatabaseRoles resource gets the master password only as a dynamic reference', () => {
    const t = template();
    const resources = t.findResources('Custom::DatabaseRoles');
    expect(Object.keys(resources)).toHaveLength(1);
    const props = JSON.stringify(Object.values(resources)[0]);
    expect(props).toContain('{{resolve:secretsmanager:');
    expect(props).toContain(':SecretString:password::}}');
    expect(props).toContain('MasterUserSecret.SecretArn');
    t.hasResourceProperties('Custom::DatabaseRoles', {
      Database: 'therapy_service_hours',
      MasterUsername: 'dbadmin',
      Revision: Match.anyValue(),
    });
  });

  test('no Lambda role may read Secrets Manager: nothing calls it at runtime', () => {
    // IAM actions look like "secretsmanager:GetSecretValue"; the dynamic reference text is not an action.
    expect(JSON.stringify(template().toJSON())).not.toMatch(/"secretsmanager:[A-Za-z*]+"/);
  });

  test('the handler is the arm64 provided.al2023 dbbootstrap binary, in the isolated subnets', () => {
    template().hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'therapy-service-hours-dev-db-bootstrap',
      Runtime: 'provided.al2023',
      Architectures: ['arm64'],
      Handler: 'bootstrap',
      VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue(), SecurityGroupIds: Match.anyValue() }),
    });
  });

  test('its security group reaches only PostgreSQL on the database and HTTPS out', () => {
    template().hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupName: 'therapy-service-hours-dev-db-bootstrap',
      SecurityGroupEgress: [{ CidrIp: '0.0.0.0/0', IpProtocol: 'tcp', FromPort: 443, ToPort: 443, Description: Match.anyValue() }],
    });
    template().hasResourceProperties('AWS::EC2::SecurityGroupEgress', { IpProtocol: 'tcp', FromPort: 5432, ToPort: 5432 });
  });

  test('its logs are kept for the environment retention', () => {
    template().hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/therapy-service-hours-dev-db-bootstrap',
      RetentionInDays: 14,
    });
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
    expect(() => artifacts.code('migrate')).toThrow(/no migrate\/bootstrap/);
  });

  test('the placeholder is flagged', () => {
    expect(placeholderArtifacts().placeholder).toBe(true);
  });
});
