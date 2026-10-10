import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { APP_REGION, EnvConfig } from './types';

/** Prod: manual approval after dev; stateful resources are protected (CLAUDE.md §4.2, ARC-30, ARC-35). */
export const prodConfig: EnvConfig = {
  envName: 'prod',
  region: APP_REGION,
  availabilityZones: ['us-west-2a', 'us-west-2b'],
  owner: 'malcolmjefferson',
  logRetention: RetentionDays.ONE_MONTH,
  database: {
    backupRetention: Duration.days(7),
    deletionProtection: true,
    removalPolicy: RemovalPolicy.SNAPSHOT,
    deleteAutomatedBackups: false,
  },
};
