import { CustomResource, Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME, Database } from './database';
import { denyLogGroupCreation } from './lambda-role';
import { Network } from './network';

/**
 * Bump to re-run the bootstrap on the next deploy (for example after changing the role SQL in
 * the backend's internal/dbroles). The bootstrap is idempotent, so re-running is always safe.
 */
export const DATABASE_ROLES_REVISION = '2';

/** Props for {@link DatabaseRoles}. */
export interface DatabaseRolesProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly network: Network;
  readonly database: Database;
  readonly artifacts: LambdaArtifacts;
}

/**
 * Creates the `app_rw` and `migrator` database roles at deploy time (ADR-0001, amended 2026-10-10).
 *
 * CloudFormation does not resolve Secrets Manager dynamic references in custom-resource properties,
 * and VPC Lambdas cannot reach Secrets Manager. So:
 *
 * - the **provider** (`dbbootstrap-provider`, outside the VPC) is the custom-resource handler. It may
 *   read only the RDS-managed master secret and invoke only the worker;
 * - the **worker** (`dbbootstrap`, in the VPC) receives the connection in that one invocation and runs
 *   the idempotent role SQL. Its security group reaches only PostgreSQL on the database.
 *
 * The password is never in the template, an environment variable or a log.
 */
export class DatabaseRoles extends Construct {
  readonly worker: lambda.Function;
  readonly provider: lambda.Function;
  readonly securityGroup: ec2.SecurityGroup;
  readonly resource: CustomResource;

  constructor(scope: Construct, id: string, props: DatabaseRolesProps) {
    super(scope, id);
    const { config, prefix, network, database } = props;

    this.securityGroup = new ec2.SecurityGroup(this, 'Sg', {
      vpc: network.vpc,
      securityGroupName: `${prefix}db-bootstrap`,
      description: 'Database role bootstrap worker: PostgreSQL to RDS only',
      allowAllOutbound: false,
    });
    this.securityGroup.addEgressRule(network.databaseSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL to RDS');
    network.databaseSecurityGroup.addIngressRule(this.securityGroup, ec2.Port.tcp(5432), 'PostgreSQL from the role bootstrap');

    this.worker = new lambda.Function(this, 'Handler', {
      functionName: `${prefix}db-bootstrap`,
      description: 'Creates the app_rw and migrator database roles (ADR-0001); invoked by the provider',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('dbbootstrap'),
      memorySize: 128,
      timeout: Duration.minutes(2),
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      logGroup: this.logGroup('Logs', `/aws/lambda/${prefix}db-bootstrap`, config),
    });

    this.provider = new lambda.Function(this, 'Provider', {
      functionName: `${prefix}db-bootstrap-provider`,
      description: 'Deploy-time custom resource: reads the RDS master secret and invokes the db-bootstrap worker',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('dbbootstrap-provider'),
      memorySize: 128,
      timeout: Duration.minutes(3),
      logGroup: this.logGroup('ProviderLogs', `/aws/lambda/${prefix}db-bootstrap-provider`, config),
    });
    // Only this one secret, only this one function (SEC-64, ADR-0001 amendment).
    this.provider.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: [database.masterSecretArn] }),
    );
    this.worker.grantInvoke(this.provider);
    // The provider runs while the stack is deleted: it must not leave an orphaned log group behind.
    denyLogGroupCreation(this.provider, `/aws/lambda/${prefix}db-bootstrap-provider`);
    denyLogGroupCreation(this.worker, `/aws/lambda/${prefix}db-bootstrap`);

    this.resource = new CustomResource(this, 'Roles', {
      serviceToken: this.provider.functionArn,
      resourceType: 'Custom::DatabaseRoles',
      properties: {
        MasterSecretArn: database.masterSecretArn,
        WorkerFunction: this.worker.functionName,
        Host: database.instance.dbInstanceEndpointAddress,
        Port: database.instance.dbInstanceEndpointPort,
        Database: DATABASE_NAME,
        Revision: DATABASE_ROLES_REVISION,
      },
    });
    this.resource.node.addDependency(database.instance);
  }

  private logGroup(id: string, name: string, config: EnvConfig): logs.LogGroup {
    return new logs.LogGroup(this, id, { logGroupName: name, retention: config.logRetention, removalPolicy: RemovalPolicy.DESTROY });
  }
}
