import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/** PostgreSQL engine for every environment. Minor upgrades apply automatically. */
export const POSTGRES_ENGINE_VERSION = rds.PostgresEngineVersion.VER_17_9;

/** Name of the application database inside the instance. */
export const DATABASE_NAME = 'therapy_service_hours';

/** Master user. Used only by the role bootstrap (ADR-0001); its password is generated and held by RDS. */
export const MASTER_USERNAME = 'dbadmin';

/** Props for {@link Database}. */
export interface DatabaseProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
}

/**
 * The single RDS PostgreSQL instance of an environment (CLAUDE.md §2, §4.2; ADR-0001).
 *
 * - `db.t4g.micro`, single-AZ, 20 GB gp3, in private isolated subnets, not publicly accessible.
 * - Encrypted with the AWS-managed key (customer-managed keys cost extra, CLAUDE.md §4.2).
 * - **IAM authentication** on; TLS required (`rds.force_ssl = 1`).
 * - The master password is generated and stored in Secrets Manager **by RDS**
 *   (`ManageMasterUserPassword`), so it never appears in code or templates.
 * - Backups, deletion protection and removal policy come from the environment config (ARC-30, ARC-35).
 */
export class Database extends Construct {
  readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    const { config, prefix } = props;
    const engine = rds.DatabaseInstanceEngine.postgres({ version: POSTGRES_ENGINE_VERSION });

    const parameterGroup = new rds.ParameterGroup(this, 'Parameters', {
      engine,
      description: `${prefix}postgres parameters`,
      parameters: {
        'rds.force_ssl': '1',
        // Log slow statements by duration only; parameter values are never logged (SEC-50).
        log_min_duration_statement: '1000',
        log_statement: 'none',
      },
    });

    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      instanceIdentifier: `${prefix}postgres`,
      engine,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      publiclyAccessible: false,
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      databaseName: DATABASE_NAME,
      credentials: rds.Credentials.fromUsername(MASTER_USERNAME),
      manageMasterUserPassword: true,
      iamAuthentication: true,
      parameterGroup,
      backupRetention: config.database.backupRetention,
      deleteAutomatedBackups: false,
      deletionProtection: config.database.deletionProtection,
      removalPolicy: config.database.removalPolicy,
      copyTagsToSnapshot: true,
      autoMinorVersionUpgrade: true,
      preferredBackupWindow: '10:00-10:30',
      preferredMaintenanceWindow: 'sun:11:00-sun:11:30',
      cloudwatchLogsExports: ['postgresql'],
      monitoringInterval: Duration.seconds(0),
      enablePerformanceInsights: false,
    });

    // The log group RDS exports to, created here with the environment's retention (ARC-43). This
    // avoids CDK's log-retention helper Lambda, whose policy needs a wildcard resource (SEC-64).
    const logGroup = new logs.LogGroup(this, 'PostgresLogs', {
      logGroupName: `/aws/rds/instance/${prefix}postgres/postgresql`,
      retention: config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.instance.node.addDependency(logGroup);
  }

  /** ARN of the RDS-managed master secret, for the one-time role bootstrap (ADR-0001). */
  get masterSecretArn(): string {
    return (this.instance.node.defaultChild as rds.CfnDBInstance).attrMasterUserSecretSecretArn;
  }
}
