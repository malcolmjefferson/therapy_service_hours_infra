import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { ALARM_PERIOD, ALARM_THRESHOLDS } from './alerts';
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

    const alerts = props.data.alerts;
    const fn = this.api.function;
    alerts.alarm(this, 'Api5xxAlarm', {
      alarmName: `${prefix}api-5xx`,
      alarmDescription: `${ALARM_THRESHOLDS.api5xx} or more API 5xx responses in 5 minutes`,
      metric: this.api.httpApi.metricServerError({ period: ALARM_PERIOD, statistic: 'Sum' }),
      threshold: ALARM_THRESHOLDS.api5xx,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
    alerts.alarm(this, 'ApiErrorsAlarm', {
      alarmName: `${prefix}api-lambda-errors`,
      alarmDescription: `${ALARM_THRESHOLDS.lambdaErrors} or more api Lambda errors in 5 minutes`,
      metric: fn.metricErrors({ period: ALARM_PERIOD, statistic: 'Sum' }),
      threshold: ALARM_THRESHOLDS.lambdaErrors,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
    alerts.alarm(this, 'ApiThrottlesAlarm', {
      alarmName: `${prefix}api-lambda-throttles`,
      alarmDescription: 'The api Lambda was throttled (reserved concurrency reached)',
      metric: fn.metricThrottles({ period: ALARM_PERIOD, statistic: 'Sum' }),
      threshold: ALARM_THRESHOLDS.lambdaThrottles,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      description: 'HTTP API default endpoint (users go through CloudFront instead)',
      value: this.api.httpApi.apiEndpoint,
    });
    new CfnOutput(this, 'ApiFunctionName', { value: this.api.function.functionName });
  }
}
