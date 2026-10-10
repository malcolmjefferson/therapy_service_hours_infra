import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { LambdaArtifacts } from '../artifacts';
import { ALARM_PERIOD, ALARM_THRESHOLDS, Alerts } from './alerts';
import { Database } from './database';
import { DatabaseRoles } from './database-roles';
import { Migrate } from './migrate';
import { Network } from './network';

/** Props for {@link DataStack}. */
export interface DataStackProps extends StackProps {
  readonly config: EnvConfig;
  readonly artifacts: LambdaArtifacts;
}

/**
 * Long-lived, stateful resources: network, RDS and database roles (ARC-27).
 * Deployed before migrations run, so it never depends on the app stack.
 */
export class DataStack extends Stack {
  readonly network: Network;
  readonly database: Database;
  readonly roles: DatabaseRoles;
  readonly alerts: Alerts;
  readonly migrate: Migrate;
  /** Name of the migrate Lambda, for the pipeline's migrate step (S0-15). */
  readonly migrateFunctionOutput: CfnOutput;
  private readonly zones: readonly string[];

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    this.zones = props.config.availabilityZones;
    const prefix = resourcePrefix(props.config);
    this.alerts = new Alerts(this, 'Alerts', { config: props.config, prefix });

    this.network = new Network(this, 'Network', { prefix, availabilityZones: props.config.availabilityZones });
    this.database = new Database(this, 'Database', {
      config: props.config,
      prefix,
      vpc: this.network.vpc,
      securityGroup: this.network.databaseSecurityGroup,
    });
    this.roles = new DatabaseRoles(this, 'DatabaseRoles', {
      config: props.config,
      prefix,
      network: this.network,
      database: this.database,
      artifacts: props.artifacts,
    });
    this.migrate = new Migrate(this, 'Migrate', {
      config: props.config,
      prefix,
      artifacts: props.artifacts,
      vpc: this.network.vpc,
      appSecurityGroup: this.network.appSecurityGroup,
      database: this.database.instance,
    });
    // Migrations need the roles; the bootstrap runs first.
    this.migrate.node.addDependency(this.roles);
    this.migrateFunctionOutput = new CfnOutput(this, 'MigrateFunctionName', { value: this.migrate.function.functionName });
    this.addDatabaseAlarms(prefix);
  }

  private addDatabaseAlarms(prefix: string): void {
    const db = this.database.instance;
    this.alerts.alarm(this, 'RdsCpuAlarm', {
      alarmName: `${prefix}rds-cpu`,
      alarmDescription: `RDS CPU above ${ALARM_THRESHOLDS.rdsCpuPercent}% for 15 minutes`,
      metric: db.metricCPUUtilization({ period: ALARM_PERIOD }),
      threshold: ALARM_THRESHOLDS.rdsCpuPercent,
      evaluationPeriods: 3,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    this.alerts.alarm(this, 'RdsStorageAlarm', {
      alarmName: `${prefix}rds-free-storage`,
      alarmDescription: 'RDS free storage below 2 GiB',
      metric: db.metricFreeStorageSpace({ period: ALARM_PERIOD, statistic: 'Minimum' }),
      threshold: ALARM_THRESHOLDS.rdsFreeStorageBytes,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
    });
    this.alerts.alarm(this, 'RdsConnectionsAlarm', {
      alarmName: `${prefix}rds-connections`,
      alarmDescription: `RDS connections above ${ALARM_THRESHOLDS.rdsConnections} for 10 minutes (pool and reserved concurrency budget)`,
      metric: db.metricDatabaseConnections({ period: ALARM_PERIOD, statistic: 'Maximum' }),
      threshold: ALARM_THRESHOLDS.rdsConnections,
      evaluationPeriods: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }

  /** The configured AZs, so synth never performs an AWS context lookup. */
  override get availabilityZones(): string[] {
    return [...this.zones];
  }
}
