import { CustomResource, Duration, RemovalPolicy, SecretValue } from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME, Database, MASTER_USERNAME } from './database';
import { Network } from './network';

/**
 * Bump to re-run the bootstrap on the next deploy (for example after changing the role SQL in
 * the backend's internal/dbroles). The bootstrap is idempotent, so re-running is always safe.
 */
export const DATABASE_ROLES_REVISION = '1';

/** Props for {@link DatabaseRoles}. */
export interface DatabaseRolesProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly network: Network;
  readonly database: Database;
  readonly artifacts: LambdaArtifacts;
}

/**
 * Creates the `app_rw` and `migrator` database roles with a custom resource (ADR-0001, S0-08).
 *
 * The handler is the backend's `dbbootstrap` Lambda, in the VPC. CloudFormation resolves the
 * RDS-managed master password through a **dynamic reference** at deploy time and passes it in the
 * resource properties, so no Lambda ever calls Secrets Manager and the password is never in the
 * template. The handler has its own security group: PostgreSQL to the database, plus HTTPS out so
 * it can send its result to CloudFormation's S3 response URL. The only route out of the isolated
 * subnets is the S3 gateway endpoint.
 */
export class DatabaseRoles extends Construct {
  readonly handler: lambda.Function;
  readonly securityGroup: ec2.SecurityGroup;
  readonly resource: CustomResource;

  constructor(scope: Construct, id: string, props: DatabaseRolesProps) {
    super(scope, id);
    const { prefix, network, database } = props;

    this.securityGroup = new ec2.SecurityGroup(this, 'Sg', {
      vpc: network.vpc,
      securityGroupName: `${prefix}db-bootstrap`,
      description: 'Database role bootstrap: PostgreSQL to RDS, HTTPS to the CloudFormation response URL',
      allowAllOutbound: false,
    });
    this.securityGroup.addEgressRule(network.databaseSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL to RDS');
    // Egress only; the isolated subnets route nothing but the S3 gateway endpoint.
    this.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'CloudFormation response URL (S3 via gateway endpoint)');
    network.databaseSecurityGroup.addIngressRule(this.securityGroup, ec2.Port.tcp(5432), 'PostgreSQL from the role bootstrap');

    const logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: `/aws/lambda/${prefix}db-bootstrap`,
      retention: props.config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.handler = new lambda.Function(this, 'Handler', {
      functionName: `${prefix}db-bootstrap`,
      description: 'Creates the app_rw and migrator database roles (ADR-0001)',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('dbbootstrap'),
      memorySize: 128,
      timeout: Duration.minutes(2),
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      logGroup,
    });

    const masterPassword = SecretValue.secretsManager(database.masterSecretArn, { jsonField: 'password' });
    this.resource = new CustomResource(this, 'Roles', {
      serviceToken: this.handler.functionArn,
      resourceType: 'Custom::DatabaseRoles',
      properties: {
        Host: database.instance.dbInstanceEndpointAddress,
        Port: database.instance.dbInstanceEndpointPort,
        Database: DATABASE_NAME,
        MasterUsername: MASTER_USERNAME,
        // Resolved by CloudFormation at deploy time; the template holds only the reference.
        MasterPassword: masterPassword.unsafeUnwrap(),
        Revision: DATABASE_ROLES_REVISION,
      },
    });
    this.resource.node.addDependency(database.instance);
  }
}
