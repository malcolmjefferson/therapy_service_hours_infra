import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/** Props for {@link DataStack}. */
export interface DataStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * Long-lived, stateful resources: network, RDS and database roles (ARC-27).
 * Deployed before migrations run, so it never depends on the app stack.
 * The network and database constructs are added by S0-07 and S0-08.
 */
export class DataStack extends Stack {
  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
  }
}
