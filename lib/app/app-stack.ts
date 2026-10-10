import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/** Props for {@link AppStack}. */
export interface AppStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * Stateless application resources: Lambdas, API Gateway, Step Functions and Cognito triggers (ARC-27).
 * The api construct is added by S0-11.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
  }
}
