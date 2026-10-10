import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

/** Names of the deployment environments (CLAUDE.md §4.2). */
export type EnvName = 'dev' | 'prod';

/** The only region this app deploys to (CLAUDE.md §2). */
export const APP_REGION = 'us-west-2';

/** Value of the mandatory `app` tag and the base of every resource name (CLAUDE.md §3, ARC-31). */
export const APP_NAME = 'therapy-service-hours';

/**
 * Typed per-environment settings. Environment differences live only here (ARC-28, ARC-47):
 * constructs read these values and never branch on the environment name. The AWS account is
 * deliberately not here: it comes from EXPECTED_AWS_ACCOUNT (see lib/account.ts).
 */
export interface EnvConfig {
  readonly envName: EnvName;
  readonly region: typeof APP_REGION;
  /**
   * The two Availability Zones for the isolated subnets. Fixed in config so synth never needs an
   * AWS lookup (and so works without credentials).
   */
  readonly availabilityZones: readonly [string, string];
  /** Value of the mandatory `owner` tag. */
  readonly owner: string;
  /** CloudWatch log retention for every log group (ARC-43). */
  readonly logRetention: RetentionDays;
  readonly database: DatabaseSettings;
  readonly api: ApiSettings;
}

/**
 * API sizing (S0-11). The API Lambda's pgx pool holds at most 2 connections per instance (GO-40),
 * so reserved concurrency x 2 must stay well under the db.t4g.micro connection limit (about 80
 * usable after RDS reserves its own). 20 x 2 = 40 leaves room for migrate, the bootstrap and psql.
 */
export interface ApiSettings {
  /** Reserved concurrency of the API Lambda: caps DB connections and cost under load (SEC-81). */
  readonly reservedConcurrency: number;
  /** Default stage throttling for every route (SEC-80). Search routes get tighter limits in S6/S10. */
  readonly throttle: { readonly rateLimit: number; readonly burstLimit: number };
  readonly memoryMiB: number;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** RDS settings that differ between environments (CLAUDE.md §4.2, ARC-30, ARC-35). */
export interface DatabaseSettings {
  readonly backupRetention: Duration;
  readonly deletionProtection: boolean;
  readonly removalPolicy: RemovalPolicy;
}

/** Prefix for resource and stack names, for example `therapy-service-hours-dev-` (ARC-31). */
export function resourcePrefix(config: Pick<EnvConfig, 'envName'>): string {
  return `${APP_NAME}-${config.envName}-`;
}
