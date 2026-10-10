import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { Web } from './web';

/** Props for {@link WebStack}. */
export interface WebStackProps extends StackProps {
  readonly config: EnvConfig;
  /** Host name of the HTTP API's default endpoint, from the app stack. */
  readonly apiDomainName: string;
}

/**
 * The SPA bucket and the CloudFront distribution that fronts both the SPA and `/api/*` (ARC-27, ADR-0004).
 */
export class WebStack extends Stack {
  readonly web: Web;
  readonly urlOutput: CfnOutput;
  readonly bucketNameOutput: CfnOutput;
  readonly distributionIdOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    this.web = new Web(this, 'Web', { config: props.config, prefix: resourcePrefix(props.config), apiDomainName: props.apiDomainName });

    this.urlOutput = new CfnOutput(this, 'Url', { description: 'Public URL', value: `https://${this.web.distribution.distributionDomainName}` });
    this.bucketNameOutput = new CfnOutput(this, 'BucketName', { description: 'SPA bucket (frontend sync target)', value: this.web.bucket.bucketName });
    this.distributionIdOutput = new CfnOutput(this, 'DistributionId', { description: 'For index.html invalidation', value: this.web.distribution.distributionId });
  }
}
