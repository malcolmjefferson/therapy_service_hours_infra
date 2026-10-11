import { App, Stack } from 'aws-cdk-lib/core';
import { expect, test } from 'vitest';
import { preSignUpDatabaseConnectPolicy } from '../lib/app/presignup-policy';

test('the trigger connect policy grants one database user on one instance, without wildcards', () => {
  const stack = new Stack(new App(), 'PolicyTest', { env: { account: '123456789012', region: 'us-west-2' } });
  const policy = preSignUpDatabaseConnectPolicy(stack, 'db-testinstance').toStatementJson();
  expect(policy).toEqual({
    Effect: 'Allow',
    Action: 'rds-db:connect',
    Resource: `arn:${stack.partition}:rds-db:us-west-2:123456789012:dbuser:db-testinstance/presignup_ro`,
  });
});
