import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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
import { PRESIGNUP_DB_USER, preSignUpDatabaseConnectPolicy } from './presignup-policy';

export interface PreSignUpProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly artifacts: LambdaArtifacts;
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly database: rds.IDatabaseInstance;
  readonly userPool?: cognito.UserPool;
}

/** App-owned invitation gate. Deploy its alias first with auth disabled, then activate the pool. */
export class PreSignUp extends Construct {
  readonly function: lambda.Function;
  readonly alias: lambda.Alias;

  constructor(scope: Construct, id: string, props: PreSignUpProps) {
    super(scope, id);
    const { config, prefix } = props;
    const sizing = config.auth.preSignUp;
    if (!Number.isInteger(sizing.memoryMiB) || sizing.memoryMiB < 128 || sizing.memoryMiB > 256
      || sizing.reservedConcurrency !== 1 || sizing.provisionedConcurrency !== 1) {
      throw new Error('Pre-sign-up requires 128–256 MiB and exactly one reserved/provisioned execution (ADR-0007)');
    }
    this.function = new lambda.Function(this, 'Function', {
      functionName: `${prefix}presignup`,
      description: 'Read-only pending invitation gate; fails closed within Cognito trigger budget',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('presignup'),
      memorySize: sizing.memoryMiB,
      timeout: Duration.seconds(5),
      reservedConcurrentExecutions: sizing.reservedConcurrency,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      logGroup: new logs.LogGroup(this, 'Logs', {
        logGroupName: `/aws/lambda/${prefix}presignup`,
        retention: config.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        APP_ENV: config.envName,
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_PORT: props.database.dbInstanceEndpointPort,
        DB_NAME: DATABASE_NAME,
        DB_USER: PRESIGNUP_DB_USER,
        DB_AUTH: 'iam',
      },
    });
    denyLogGroupCreation(this.function, `/aws/lambda/${prefix}presignup`);
    const resourceId = props.database.instanceResourceId;
    if (!resourceId) throw new Error('Pre-sign-up requires the RDS instance resource ID for scoped IAM authentication');
    this.function.addToRolePolicy(preSignUpDatabaseConnectPolicy(this, resourceId));
    this.alias = new lambda.Alias(this, 'Live', {
      aliasName: 'live',
      version: this.function.currentVersion,
      provisionedConcurrentExecutions: sizing.provisionedConcurrency,
    });
    if (props.userPool) {
      // Install the known alias ARN, not the app's functionArn token. CloudFormation keeps
      // the trigger in the pool template on every update; no runtime UpdateUserPool call can
      // reset omitted settings. The data template has no app reference (ADR-0009).
      const poolStack = Stack.of(props.userPool);
      const stableAliasArn = poolStack.formatArn({ service: 'lambda', resource: 'function', resourceName: `${prefix}presignup:live`, arnFormat: ArnFormat.COLON_RESOURCE_NAME });
      const cfnPool = props.userPool.node.defaultChild as cognito.CfnUserPool;
      cfnPool.addPropertyOverride('LambdaConfig.PreSignUp', stableAliasArn);
      this.alias.addPermission('Cognito', {
        principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
        sourceArn: props.userPool.userPoolArn,
        sourceAccount: Stack.of(this).account,
      });
    }
  }
}
