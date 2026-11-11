import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib/core';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME } from './database';
import { denyLogGroupCreation } from './lambda-role';

export interface IdempotencyPurgeProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly artifacts: LambdaArtifacts;
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly database: rds.IDatabaseInstance;
}

/**
 * Daily 10:30 UTC (03:30 in Oregon, outside the working day): keys last 24 hours, so a daily run
 * keeps the table to about two days of rows.
 */
export const IDEMPOTENCY_PURGE_SCHEDULE = events.Schedule.cron({ minute: '30', hour: '10' });

/**
 * Scheduled cleanup of expired Idempotency-Key records (S2-09). It runs in the isolated VPC like
 * the other database Lambdas and connects as app_rw over IAM, so it needs no internet, no secret
 * and no NAT. It has no reserved concurrency: one run a day cannot overlap itself, and a
 * reservation would only tighten the account's unreserved-concurrency preflight.
 */
export class IdempotencyPurge extends Construct {
  readonly function: lambda.Function;
  readonly rule: events.Rule;

  constructor(scope: Construct, id: string, props: IdempotencyPurgeProps) {
    super(scope, id);
    const { config, prefix } = props;
    this.function = new lambda.Function(this, 'Function', {
      functionName: `${prefix}idempotency-purge`,
      description: 'Deletes expired Idempotency-Key records in batches; logs only the count',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('idempotency-purge'),
      memorySize: 128,
      // The handler stops deleting after 50 seconds and needs room to connect and log.
      timeout: Duration.seconds(60),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      logGroup: new logs.LogGroup(this, 'Logs', {
        logGroupName: `/aws/lambda/${prefix}idempotency-purge`,
        retention: config.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        APP_ENV: config.envName,
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_PORT: props.database.dbInstanceEndpointPort,
        DB_NAME: DATABASE_NAME,
        DB_USER: 'app_rw',
        DB_AUTH: 'iam',
      },
    });
    denyLogGroupCreation(this.function, `/aws/lambda/${prefix}idempotency-purge`);
    this.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [Stack.of(this).formatArn({ service: 'rds-db', resource: 'dbuser', resourceName: `${props.database.instanceResourceId}/app_rw`, arnFormat: ArnFormat.COLON_RESOURCE_NAME })],
    }));
    this.rule = new events.Rule(this, 'Daily', {
      ruleName: `${prefix}idempotency-purge-daily`,
      description: 'Daily cleanup of expired Idempotency-Key records',
      schedule: IDEMPOTENCY_PURGE_SCHEDULE,
      // Expired rows are harmless until deleted and the next run catches up, so a failed run is
      // retried once and then left to the next day (the alarm reports it).
      targets: [new targets.LambdaFunction(this.function, { retryAttempts: 1, maxEventAge: Duration.hours(1) })],
    });
  }
}
