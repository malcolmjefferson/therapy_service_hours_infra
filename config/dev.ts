import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { APP_REGION, EnvConfig } from './types';

/** Dev: deploys automatically on merge to main; cheap to recreate (CLAUDE.md §4.2). */
export const devConfig: EnvConfig = {
  envName: 'dev',
  region: APP_REGION,
  owner: 'malcolmjefferson',
  logRetention: RetentionDays.TWO_WEEKS,
  database: {
    backupRetention: Duration.days(1),
    deletionProtection: false,
    removalPolicy: RemovalPolicy.DESTROY,
  },
};
