import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME } from './database';
import { denyLogGroupCreation } from './lambda-role';
import { Auth } from './auth';

export interface SeedProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly artifacts: LambdaArtifacts;
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly database: rds.IDatabaseInstance;
  readonly auth?: Auth;
}

/** IAM-invoked, isolated-VPC bootstrap. It never sends messages or calls Cognito. */
export class Seed extends Construct {
  readonly function: lambda.Function;
  readonly nameOutput: CfnOutput;
  readonly operatorArnOutput?: CfnOutput;

  constructor(scope: Construct, id: string, props: SeedProps) {
    super(scope, id);
    const { config, prefix } = props;
    if (config.seed.reservedConcurrency !== 1 || (config.envName === 'prod' && (config.seed.includeDevUsers || config.seed.onDeploy))) {
      throw new Error('Seed requires one reserved execution; prod forbids dev fixtures and automatic seeding');
    }
    this.function = new lambda.Function(this, 'Function', {
      functionName: `${prefix}seed`, runtime: lambda.Runtime.PROVIDED_AL2023, architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap', code: props.artifacts.code('seed'), memorySize: 128, timeout: Duration.seconds(60),
      reservedConcurrentExecutions: config.seed.reservedConcurrency,
      vpc: props.vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, securityGroups: [props.securityGroup],
      logGroup: new logs.LogGroup(this, 'Logs', { logGroupName: `/aws/lambda/${prefix}seed`, retention: config.logRetention, removalPolicy: RemovalPolicy.DESTROY }),
      environment: { APP_ENV: config.envName, DB_HOST: props.database.dbInstanceEndpointAddress, DB_PORT: props.database.dbInstanceEndpointPort, DB_NAME: DATABASE_NAME, DB_USER: 'app_rw', DB_AUTH: 'iam' },
    });
    denyLogGroupCreation(this.function, `/aws/lambda/${prefix}seed`);
    this.function.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-db:connect'],
      resources: [Stack.of(this).formatArn({ service: 'rds-db', resource: 'dbuser', resourceName: `${props.database.instanceResourceId}/app_rw`, arnFormat: ArnFormat.COLON_RESOURCE_NAME })],
    }));
    this.nameOutput = new CfnOutput(this, 'FunctionName', { value: this.function.functionName });
    if (config.seed.onDeploy) {
      // The pipeline role has a fixed name, so this trust relationship needs no cross-stage token.
      const stack = Stack.of(this);
      const roleArn = (name: string) => stack.formatArn({ service: 'iam', region: '', resource: 'role', resourceName: name });
      const operator = new iam.Role(this, 'Operator', {
        roleName: `${prefix}seed-operator`,
        assumedBy: new iam.AccountPrincipal(stack.account).withConditions({ ArnEquals: { 'aws:PrincipalArn': roleArn(`${prefix}seed-runner`) } }),
      });
      this.function.grantInvoke(operator);
      if (props.auth?.testCredentials) {
        props.auth.testCredentials.grantRead(operator);
        operator.addToPolicy(new iam.PolicyStatement({
          actions: ['cognito-idp:DescribeUserPool', 'cognito-idp:DescribeUserPoolClient', 'cognito-idp:AdminGetUser', 'cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminListGroupsForUser', 'cognito-idp:AdminAddUserToGroup'],
          resources: [props.auth.userPool.userPoolArn],
        }));
      }
      this.operatorArnOutput = new CfnOutput(this, 'OperatorArn', { value: operator.roleArn });
    }
  }
}
