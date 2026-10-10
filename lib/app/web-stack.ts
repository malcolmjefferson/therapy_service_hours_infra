import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/** Props for {@link WebStack}. */
export interface WebStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * The SPA bucket and the CloudFront distribution that fronts both the SPA and `/api/*` (ARC-27, ADR-0004).
 * The web construct is added by S0-12.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
  }
}
