import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { APP_REGION, EnvConfig } from './types';

/** Dev: deploys automatically on merge to main; cheap to recreate (CLAUDE.md §4.2). */
export const devConfig: EnvConfig = {
  envName: 'dev',
  region: APP_REGION,
  availabilityZones: ['us-west-2a', 'us-west-2b'],
  owner: 'malcolmjefferson',
  seed: { onDeploy: true, adminEmail: 'malcolmj0415@gmail.com', includeDevUsers: true, reservedConcurrency: 1 },
  logRetention: RetentionDays.TWO_WEEKS,
  auth: {
    enabled: true, // Paired Gateway/browser preparation is released; activate dev only.
    googleSecretName: 'therapy-service-hours/dev/google-oauth',
    googleClientIdKey: 'client_id',
    googleClientSecretKey: 'client_secret',
    domainPrefix: 'therapy-service-hours-dev-malcolmjefferson',
    callbackUrls: ['https://dx5eaoy4duyuy.cloudfront.net/auth/callback'],
    logoutUrls: ['https://dx5eaoy4duyuy.cloudfront.net/'],
    removalPolicy: RemovalPolicy.DESTROY,
    deletionProtection: false,
    createPasswordTestClient: true,
    preSignUp: { memoryMiB: 128, reservedConcurrency: 1, provisionedConcurrency: 1 },
  },
  api: {
    reservedConcurrency: 20,
    throttle: { rateLimit: 50, burstLimit: 100 },
    memoryMiB: 256,
    logLevel: 'info',
  },
  alerts: {
    email: 'malcolmj0415@gmail.com',
  },
  web: {
    bucketRemovalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  },
  database: {
    backupRetention: Duration.days(1),
    deletionProtection: false,
    removalPolicy: RemovalPolicy.DESTROY,
    deleteAutomatedBackups: true,
  },
};
