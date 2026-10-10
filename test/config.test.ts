import { describe, expect, test } from 'vitest';
import { Duration, RemovalPolicy } from 'aws-cdk-lib/core';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { APP_REGION, ENVIRONMENTS, devConfig, prodConfig, resourcePrefix } from '../config';

describe('environment config (CLAUDE.md §4.2)', () => {
  test('both environments deploy to us-west-2', () => {
    for (const config of Object.values(ENVIRONMENTS)) {
      expect(config.region).toBe(APP_REGION);
      expect(config.region).toBe('us-west-2');
    }
  });

  test('no account ID is committed in config (ARC-32)', () => {
    for (const config of Object.values(ENVIRONMENTS)) {
      expect(JSON.stringify(config)).not.toMatch(/\d{12}/);
    }
  });

  test('log retention is 14 days in dev and 30 days in prod (ARC-43)', () => {
    expect(devConfig.logRetention).toBe(RetentionDays.TWO_WEEKS);
    expect(prodConfig.logRetention).toBe(RetentionDays.ONE_MONTH);
  });

  test('database backups and protection follow the environment table (ARC-30, ARC-35)', () => {
    expect(devConfig.database).toEqual({
      backupRetention: Duration.days(1),
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
    });
    expect(prodConfig.database).toEqual({
      backupRetention: Duration.days(7),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      deleteAutomatedBackups: false,
    });
  });

  test('resource names use the hyphenated per-environment prefix (ARC-31)', () => {
    expect(resourcePrefix(devConfig)).toBe('therapy-service-hours-dev-');
    expect(resourcePrefix(prodConfig)).toBe('therapy-service-hours-prod-');
  });
});
