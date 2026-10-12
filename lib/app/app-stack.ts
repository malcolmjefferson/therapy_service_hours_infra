import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EnvConfig, resourcePrefix } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { ALARM_PERIOD, ALARM_THRESHOLDS } from './alerts';
import { Api } from './api';
import { DataStack } from './data-stack';
import { PreSignUp } from './presignup';
import { Seed } from './seed';

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
  readonly preSignUp: PreSignUp;
  readonly seed: Seed;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const prefix = resourcePrefix(props.config);

    this.seed = new Seed(this, 'Seed', { config: props.config, prefix, artifacts: props.artifacts, vpc: props.data.network.vpc, securityGroup: props.data.network.appSecurityGroup, database: props.data.database.instance, auth: props.data.auth });

    this.preSignUp = new PreSignUp(this, 'PreSignUp', {
      config: props.config, prefix, artifacts: props.artifacts,
      vpc: props.data.network.vpc, securityGroup: props.data.network.appSecurityGroup,
      database: props.data.database.instance, userPool: props.data.auth?.userPool,
    });

    this.api = new Api(this, 'Api', {
      auth: props.data.auth,
      config: props.config,
      prefix,
      artifacts: props.artifacts,
      vpc: props.data.network.vpc,
      appSecurityGroup: props.data.network.appSecurityGroup,
      database: props.data.database.instance,
    });

    const alerts = props.data.alerts;
    alerts.alarm(this, 'PreSignUpErrorsAlarm', {
      alarmName: `${prefix}presignup-errors`, alarmDescription: 'Pre-sign-up refusals or database errors; inspect safe decision codes',
      metric: this.preSignUp.function.metricErrors({ period: ALARM_PERIOD, statistic: 'Sum' }),
      threshold: ALARM_THRESHOLDS.lambdaErrors, evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
    alerts.alarm(this, 'PreSignUpThrottlesAlarm', {
      alarmName: `${prefix}presignup-throttles`, alarmDescription: 'Invitation gate exhausted its reserved execution',
      metric: this.preSignUp.function.metricThrottles({ period: ALARM_PERIOD, statistic: 'Sum' }),
      threshold: 1, evaluationPeriods: 1, comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
    alerts.alarm(this, 'PreSignUpDurationAlarm', {
      alarmName: `${prefix}presignup-duration`, alarmDescription: 'Invitation gate is approaching the Cognito five-second ceiling',
      metric: this.preSignUp.function.metricDuration({ period: ALARM_PERIOD, statistic: 'Maximum' }),
      threshold: 4000, evaluationPeriods: 1, comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
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
    new CfnOutput(this, 'PreSignUpAliasArn', { value: this.preSignUp.alias.functionArn });
  }
}
