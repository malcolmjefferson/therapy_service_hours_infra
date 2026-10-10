import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { Database } from './database';
import { DatabaseRoles } from './database-roles';
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
  private readonly zones: readonly string[];

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    this.zones = props.config.availabilityZones;
    const prefix = resourcePrefix(props.config);

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
  }

  /** The configured AZs, so synth never performs an AWS context lookup. */
  override get availabilityZones(): string[] {
    return [...this.zones];
  }
}
