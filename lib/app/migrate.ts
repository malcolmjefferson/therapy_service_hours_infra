import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { denyLogGroupCreation } from './lambda-role';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME } from './database';

/** Database role the migrations run as (ADR-0001). Created by the role bootstrap (S0-08). */
export const MIGRATE_DB_USER = 'migrator';

/** Props for {@link Migrate}. */
export interface MigrateProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly artifacts: LambdaArtifacts;
  readonly vpc: ec2.IVpc;
  readonly appSecurityGroup: ec2.ISecurityGroup;
  readonly database: rds.IDatabaseInstance;
}

/**
 * The migrate Lambda (ADR-0003). It lives in the data stack so it exists before the app stack, and
 * the pipeline invokes it from a non-VPC CodeBuild step between the data and app deploys.
 * It connects as `migrator` over IAM auth; the 15-minute timeout bounds every migration.
 */
export class Migrate extends Construct {
  readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: MigrateProps) {
    super(scope, id);
    const { config, prefix } = props;

    this.function = new lambda.Function(this, 'Function', {
      functionName: `${prefix}migrate`,
      description: 'Applies embedded goose migrations under an advisory lock (ADR-0003)',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('migrate'),
      memorySize: 256,
      timeout: Duration.minutes(15),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.appSecurityGroup],
      logGroup: new logs.LogGroup(this, 'Logs', {
        logGroupName: `/aws/lambda/${prefix}migrate`,
        retention: config.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_PORT: props.database.dbInstanceEndpointPort,
        DB_NAME: DATABASE_NAME,
        DB_USER: MIGRATE_DB_USER,
        DB_AUTH: 'iam',
      },
    });
    denyLogGroupCreation(this.function, `/aws/lambda/${prefix}migrate`);

    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rds-db:connect'],
        resources: [
          Stack.of(this).formatArn({
            service: 'rds-db',
            resource: 'dbuser',
            resourceName: `${props.database.instanceResourceId}/${MIGRATE_DB_USER}`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
  }
}
