import { describe, expect, test } from 'vitest';
import { App, Aspects, Stack, Stage } from 'aws-cdk-lib/core';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import { CfnLoadBalancer as CfnClassicLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';
import { ENVIRONMENTS, devConfig } from '../config';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';
import { BudgetGuard } from '../lib/guards/budget-guard';
import { synthesisErrors } from '../lib/synth-errors';
import { buildStage, stacksOf } from './helpers';

const ENV = { account: PLACEHOLDER_ACCOUNT, region: devConfig.region };

/** A stage guarded the same way as the real one, with one stack for fixture resources. */
function guardedStage(app: App, id: string): { stage: Stage; stack: Stack } {
  const stage = new Stage(app, id, { env: ENV });
  Aspects.of(stage).add(new BudgetGuard());
  return { stage, stack: new Stack(stage, 'Fixture') };
}

/** Synthesizes the stage (aspects run during synthesis) and returns the guard's error messages. */
function guardErrors(stage: Stage, stack: Stack): string[] {
  stage.synth({ force: true });
  return Annotations.fromStack(stack)
    .findError('*', Match.stringLikeRegexp('Budget guard'))
    .map((m) => String(m.entry.data));
}

function errorsFor(build: (stack: Stack) => void): string[] {
  const { stage, stack } = guardedStage(new App(), 'fixture');
  build(stack);
  return guardErrors(stage, stack);
}

describe('BudgetGuard (CLAUDE.md §0.6, ARC-29)', () => {
  test('a fixture stack with a NAT Gateway fails, naming the rule and CLAUDE.md §0.6', () => {
    const errors = errorsFor((stack) => new ec2.Vpc(stack, 'Vpc', { maxAzs: 1, natGateways: 1 }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Budget guard \[NAT_GATEWAY\]: a NAT Gateway is not allowed/);
    expect(errors[0]).toContain('CLAUDE.md §0.6');
    expect(errors[0]).toContain('ARC-29');
  });

  test('a VPC without NAT Gateways and with a free S3 gateway endpoint passes', () => {
    const errors = errorsFor((stack) => {
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        maxAzs: 2,
        natGateways: 0,
        subnetConfiguration: [{ name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
      });
      vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    });
    expect(errors).toEqual([]);
  });

  test.each<[string, (stack: Stack) => void]>([
    [
      'RDS_PROXY',
      (stack) =>
        new rds.CfnDBProxy(stack, 'Proxy', {
          dbProxyName: 'fixture',
          engineFamily: 'POSTGRESQL',
          roleArn: 'arn:aws:iam::123456789012:role/fixture',
          vpcSubnetIds: ['subnet-1', 'subnet-2'],
        }),
    ],
    [
      'INTERFACE_ENDPOINT',
      (stack) => {
        const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 1, natGateways: 0, subnetConfiguration: [{ name: 'i', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }] });
        vpc.addInterfaceEndpoint('SecretsManager', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });
      },
    ],
    [
      'LOAD_BALANCER',
      (stack) => {
        const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2, natGateways: 0, subnetConfiguration: [{ name: 'p', subnetType: ec2.SubnetType.PUBLIC }] });
        new elbv2.ApplicationLoadBalancer(stack, 'Alb', { vpc });
      },
    ],
    ['CLASSIC_LOAD_BALANCER', (stack) => new CfnClassicLoadBalancer(stack, 'Elb', { listeners: [], availabilityZones: ['us-west-2a'] })],
    [
      'MULTI_AZ_DATABASE',
      (stack) => new rds.CfnDBInstance(stack, 'Db', { dbInstanceClass: 'db.t4g.micro', engine: 'postgres', multiAz: true }),
    ],
    ['DB_CLUSTER', (stack) => new rds.CfnDBCluster(stack, 'Cluster', { engine: 'aurora-postgresql' })],
    ['CUSTOMER_MANAGED_KMS_KEY', (stack) => new kms.Key(stack, 'Key')],
    [
      'EXTRA_DATABASE',
      (stack) => {
        new rds.CfnDBInstance(stack, 'Db1', { dbInstanceClass: 'db.t4g.micro', engine: 'postgres' });
        new rds.CfnDBInstance(stack, 'Db2', { dbInstanceClass: 'db.t4g.micro', engine: 'postgres' });
      },
    ],
  ])('fails on %s', (ruleId, build) => {
    const errors = errorsFor(build);
    expect(errors.some((e) => e.includes(`[${ruleId}]`))).toBe(true);
  });

  test('one single-AZ db.t4g.micro instance per environment is allowed', () => {
    const errors = errorsFor(
      (stack) => new rds.CfnDBInstance(stack, 'Db', { dbInstanceClass: 'db.t4g.micro', engine: 'postgres', multiAz: false }),
    );
    expect(errors).toEqual([]);
  });

  test('the database count is per environment, so dev and prod may each have one', () => {
    const app = new App();
    const errors: string[] = [];
    for (const name of ['dev', 'prod']) {
      const { stage, stack } = guardedStage(app, name);
      new rds.CfnDBInstance(stack, 'Db', { dbInstanceClass: 'db.t4g.micro', engine: 'postgres' });
      errors.push(...guardErrors(stage, stack));
    }
    expect(errors).toEqual([]);
  });
});

describe.each(Object.values(ENVIRONMENTS))('real $envName stage', (config) => {
  test('passes the budget guard', () => {
    const stage = buildStage(config);
    stage.synth();
    for (const stack of stacksOf(stage)) {
      Annotations.fromStack(stack).hasNoError('*', Match.stringLikeRegexp('Budget guard'));
    }
  });

  test('applies the budget guard, so a forbidden resource added to it fails', () => {
    const stage = buildStage(config);
    new ec2.CfnNatGateway(stage.dataStack, 'ForbiddenNat', { subnetId: 'subnet-1' });
    stage.synth();
    Annotations.fromStack(stage.dataStack).hasError('*', Match.stringLikeRegexp('NAT_GATEWAY'));
  });
});

describe('synthesisErrors', () => {
  test('finds guard errors in stacks nested inside stages, where `cdk synth` would not look', () => {
    const app = new App();
    const stage = buildStage(devConfig, app);
    new ec2.CfnNatGateway(stage.dataStack, 'ForbiddenNat', { subnetId: 'subnet-1' });
    const errors = synthesisErrors(app.synth());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^\/dev\/Data\/ForbiddenNat: Budget guard \[NAT_GATEWAY\]/);
  });

  test('is empty for the real app', () => {
    const app = new App();
    for (const config of Object.values(ENVIRONMENTS)) {
      buildStage(config, app);
    }
    expect(synthesisErrors(app.synth())).toEqual([]);
  });
});
