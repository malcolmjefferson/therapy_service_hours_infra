import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { APP_REGION, EnvConfig } from './types';

/** Dev: deploys automatically on merge to main; cheap to recreate (CLAUDE.md §4.2). */
export const devConfig: EnvConfig = {
  envName: 'dev',
  region: APP_REGION,
  availabilityZones: ['us-west-2a', 'us-west-2b'],
  owner: 'malcolmjefferson',
  logRetention: RetentionDays.TWO_WEEKS,
  api: {
    reservedConcurrency: 20,
    throttle: { rateLimit: 50, burstLimit: 100 },
    memoryMiB: 256,
    logLevel: 'info',
  },
  database: {
    backupRetention: Duration.days(1),
    deletionProtection: false,
    removalPolicy: RemovalPolicy.DESTROY,
  },
};
