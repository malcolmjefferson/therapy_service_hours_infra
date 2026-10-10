import { ArnFormat, Stack } from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';

/**
 * Denies the function's role `logs:CreateLogGroup` on its own, explicitly named log group.
 *
 * CDK's default execution role uses AWS managed policies that allow `logs:CreateLogGroup` on `*`.
 * A function that runs while its stack is being deleted (a custom-resource handler, or a late log
 * flush) then recreates its log group outside the stack, and the next deploy fails with "log group
 * already exists". The stack creates the log group, so the function never needs to; an explicit
 * Deny overrides the managed policy's Allow.
 */
export function denyLogGroupCreation(fn: lambda.Function, logGroupName: string): void {
  const stack = Stack.of(fn);
  const arn = (resourceName: string) => stack.formatArn({ service: 'logs', resource: 'log-group', resourceName, arnFormat: ArnFormat.COLON_RESOURCE_NAME });
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ['logs:CreateLogGroup'],
      resources: [arn(logGroupName), arn(`${logGroupName}:*`)],
    }),
  );
}
