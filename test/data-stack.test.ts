import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ENVIRONMENTS, devConfig, prodConfig } from '../config';
import { buildStage } from './helpers';

function dataTemplate(config = devConfig): Template {
  return Template.fromStack(buildStage(config).dataStack);
}

/** Every ingress rule in the template, inline or standalone. */
function ingressRules(t: Template): Record<string, unknown>[] {
  const inline = Object.values(t.findResources('AWS::EC2::SecurityGroup')).flatMap(
    (sg) => ((sg as { Properties?: { SecurityGroupIngress?: Record<string, unknown>[] } }).Properties?.SecurityGroupIngress ?? []),
  );
  const standalone = Object.values(t.findResources('AWS::EC2::SecurityGroupIngress')).map(
    (r) => (r as { Properties: Record<string, unknown> }).Properties,
  );
  return [...inline, ...standalone];
}

describe('network (S0-07)', () => {
  test('two isolated subnets in the configured AZs; no internet gateway, NAT or public subnet', () => {
    const t = dataTemplate();
    t.resourceCountIs('AWS::EC2::Subnet', 2);
    t.hasResourceProperties('AWS::EC2::Subnet', { AvailabilityZone: 'us-west-2a', MapPublicIpOnLaunch: false });
    t.hasResourceProperties('AWS::EC2::Subnet', { AvailabilityZone: 'us-west-2b', MapPublicIpOnLaunch: false });
    t.resourceCountIs('AWS::EC2::InternetGateway', 0);
    t.resourceCountIs('AWS::EC2::NatGateway', 0);
    t.resourceCountIs('AWS::EC2::EIP', 0);
  });

  test('only a free S3 gateway endpoint, no interface endpoints', () => {
    const t = dataTemplate();
    t.resourceCountIs('AWS::EC2::VPCEndpoint', 1);
    t.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      ServiceName: Match.objectLike({ 'Fn::Join': Match.arrayWith([Match.arrayWith(['.s3'])]) }),
      VpcEndpointType: 'Gateway',
    });
  });

  test('no 0.0.0.0/0 or ::/0 ingress anywhere (SEC-65)', () => {
    const rules = ingressRules(dataTemplate());
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.CidrIp).not.toBe('0.0.0.0/0');
      expect(rule.CidrIpv6).not.toBe('::/0');
    }
  });

  test('the database accepts 5432 only from security groups (app and role bootstrap)', () => {
    const rules = ingressRules(dataTemplate());
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule).toMatchObject({ IpProtocol: 'tcp', FromPort: 5432, ToPort: 5432 });
      expect(rule).toHaveProperty('SourceSecurityGroupId');
    }
  });

  test('no security group allows all outbound traffic; the only 0.0.0.0/0 egress is HTTPS', () => {
    const t = dataTemplate();
    const egress = [
      ...Object.values(t.findResources('AWS::EC2::SecurityGroup')).flatMap(
        (sg) => (sg as { Properties: { SecurityGroupEgress?: Record<string, unknown>[] } }).Properties.SecurityGroupEgress ?? [],
      ),
      ...Object.values(t.findResources('AWS::EC2::SecurityGroupEgress')).map((r) => (r as { Properties: Record<string, unknown> }).Properties),
    ];
    for (const rule of egress) {
      if (rule.CidrIp === '0.0.0.0/0') {
        expect(rule).toMatchObject({ IpProtocol: 'tcp', FromPort: 443, ToPort: 443 });
      }
    }
  });
});

describe('database (S0-07)', () => {
  test('single-AZ db.t4g.micro PostgreSQL 17, encrypted, private, with IAM auth', () => {
    dataTemplate().hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^17\\.'),
      DBInstanceClass: 'db.t4g.micro',
      MultiAZ: false,
      StorageEncrypted: true,
      PubliclyAccessible: false,
      EnableIAMDatabaseAuthentication: true,
      KmsKeyId: Match.absent(),
    });
  });

  test('the master password is generated and held by RDS, never in the template', () => {
    const t = dataTemplate();
    t.hasResourceProperties('AWS::RDS::DBInstance', {
      ManageMasterUserPassword: true,
      MasterUsername: 'dbadmin',
      MasterUserPassword: Match.absent(),
    });
    t.resourceCountIs('AWS::SecretsManager::Secret', 0);
  });

  test('TLS is required by the parameter group', () => {
    dataTemplate().hasResourceProperties('AWS::RDS::DBParameterGroup', {
      Parameters: Match.objectLike({ 'rds.force_ssl': '1', log_statement: 'none' }),
    });
  });

  test('prod: deletion protection on, 7-day backups, snapshot on delete (ARC-30, ARC-35)', () => {
    const t = dataTemplate(prodConfig);
    t.hasResourceProperties('AWS::RDS::DBInstance', { DeletionProtection: true, BackupRetentionPeriod: 7 });
    t.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Snapshot', UpdateReplacePolicy: 'Snapshot' });
  });

  test('dev: deletion protection off, 1-day backups, deleted with the stack', () => {
    const t = dataTemplate(devConfig);
    t.hasResourceProperties('AWS::RDS::DBInstance', { DeletionProtection: false, BackupRetentionPeriod: 1 });
    t.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Delete' });
  });

  test.each(Object.values(ENVIRONMENTS))('$envName: PostgreSQL logs kept for the configured retention', (config) => {
    const days = config.envName === 'prod' ? 30 : 14;
    dataTemplate(config).hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: `/aws/rds/instance/therapy-service-hours-${config.envName}-postgres/postgresql`,
      RetentionInDays: days,
    });
  });

  test('no IAM statement anywhere in the stack uses a wildcard resource (SEC-64)', () => {
    const json = JSON.stringify(dataTemplate().toJSON());
    expect(json).not.toMatch(/"Resource":"\*"/);
    expect(json).not.toMatch(/"Resource":\["\*"\]/);
  });
});

describe('migrate Lambda (S0-15, ADR-0003)', () => {
  test('runs in the VPC as migrator with a 15-minute timeout and no secrets', () => {
    const t = dataTemplate();
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'therapy-service-hours-dev-migrate',
      Runtime: 'provided.al2023',
      Architectures: ['arm64'],
      Timeout: 900,
      VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue() }),
      Environment: { Variables: Match.objectLike({ DB_USER: 'migrator', DB_AUTH: 'iam', DB_NAME: 'therapy_service_hours' }) },
    });
    const json = JSON.stringify(t.toJSON());
    expect(json).toContain('/migrator"');
    expect(json).not.toMatch(/DB_PASSWORD/);
  });

  test('exposes its name for the pipeline step', () => {
    dataTemplate().hasOutput('MigrateFunctionName', {});
  });
});
