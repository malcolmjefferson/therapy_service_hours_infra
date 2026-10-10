import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { Api } from './api';
import { DataStack } from './data-stack';

/** Props for {@link AppStack}. */
export interface AppStackProps extends StackProps {
  readonly config: EnvConfig;
  readonly artifacts: LambdaArtifacts;
  readonly data: DataStack;
}

/**
 * Stateless application resources: Lambdas, API Gateway, Step Functions and Cognito triggers (ARC-27).
 * Deployed after the data stack and after migrations run (ADR-0003).
 */
export class AppStack extends Stack {
  readonly api: Api;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const prefix = resourcePrefix(props.config);

    this.api = new Api(this, 'Api', {
      config: props.config,
      prefix,
      artifacts: props.artifacts,
      vpc: props.data.network.vpc,
      appSecurityGroup: props.data.network.appSecurityGroup,
      database: props.data.database.instance,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      description: 'HTTP API default endpoint (users go through CloudFront instead)',
      value: this.api.httpApi.apiEndpoint,
    });
    new CfnOutput(this, 'ApiFunctionName', { value: this.api.function.functionName });
  }
}
