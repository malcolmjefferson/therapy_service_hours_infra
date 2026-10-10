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
  api: {
    reservedConcurrency: 20,
    throttle: { rateLimit: 50, burstLimit: 100 },
    memoryMiB: 256,
    logLevel: 'info',
  },
  alerts: {
    email: 'malcolmj0415@gmail.com',
    monthlyBudgetUsd: 50,
  },
  web: {
    bucketRemovalPolicy: RemovalPolicy.RETAIN,
    autoDeleteObjects: false,
  },
  database: {
    backupRetention: Duration.days(7),
    deletionProtection: true,
    removalPolicy: RemovalPolicy.SNAPSHOT,
  },
};
