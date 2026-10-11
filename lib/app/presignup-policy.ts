import { ArnFormat, Stack } from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/** IAM-authenticated PostgreSQL role used only by the invitation allowlist trigger. */
export const PRESIGNUP_DB_USER = 'presignup_ro';

/**
 * Allows the S1-03 trigger to connect as exactly presignup_ro on one RDS instance.
 * Attach this statement only to that trigger's execution role when wiring the function.
 */
export function preSignUpDatabaseConnectPolicy(scope: Construct, instanceResourceId: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    actions: ['rds-db:connect'],
    resources: [Stack.of(scope).formatArn({
      service: 'rds-db',
      resource: 'dbuser',
      resourceName: `${instanceResourceId}/${PRESIGNUP_DB_USER}`,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    })],
  });
}
