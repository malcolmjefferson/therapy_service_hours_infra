import { Duration } from 'aws-cdk-lib/core';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/**
 * Documented alarm thresholds (S0-18). Every alarm notifies the environment's alert topic on ALARM
 * and on OK, and treats missing data as not breaching, so idle environments stay quiet.
 */
export const ALARM_THRESHOLDS = {
  /** API Gateway 5xx responses in 5 minutes. */
  api5xx: 5,
  /** Lambda errors in 5 minutes, per function. */
  lambdaErrors: 5,
  /** Lambda throttles in 5 minutes, per function: any throttle means reserved concurrency was hit. */
  lambdaThrottles: 1,
  /** RDS CPU percent, averaged over 3 consecutive 5-minute periods. */
  rdsCpuPercent: 80,
  /** RDS free storage in bytes (2 GiB of the 20 GiB volume). */
  rdsFreeStorageBytes: 2 * 1024 ** 3,
  /** RDS connections, max over 2 consecutive 5-minute periods (about 80 usable on db.t4g.micro). */
  rdsConnections: 60,
} as const;

/** Props for {@link Alerts}. */
export interface AlertsProps {
  readonly config: EnvConfig;
  readonly prefix: string;
}

/**
 * The environment's SNS alert topic (email to the owner) and its alarms (ARC-44, SEC-54). The
 * account-wide budget is {@link addMonthlyBudget}, created once in the pipeline stack.
 */
export class Alerts extends Construct {
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlertsProps) {
    super(scope, id);
    const { config, prefix } = props;

    this.topic = new sns.Topic(this, 'Topic', {
      topicName: `${prefix}alerts`,
      displayName: `Therapy Service Hours ${config.envName} alerts`,
      enforceSSL: true,
    });
    this.topic.addSubscription(new subscriptions.EmailSubscription(config.alerts.email));
  }

  /** Creates an alarm that notifies the topic on ALARM and OK. */
  alarm(scope: Construct, id: string, props: cloudwatch.AlarmProps): cloudwatch.Alarm {
    const alarm = new cloudwatch.Alarm(scope, id, { treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING, ...props });
    alarm.addAlarmAction(new actions.SnsAction(this.topic));
    alarm.addOkAction(new actions.SnsAction(this.topic));
    return alarm;
  }
}

/** Five-minute evaluation period used by every alarm. */
export const ALARM_PERIOD = Duration.minutes(5);

/**
 * The account-wide AWS Budget (SEC-82): alerts at 80% and 100% of actual spend and 100% of forecast,
 * published to topic. Budgets are account-level, so exactly one stack creates it.
 */
export function addMonthlyBudget(scope: Construct, id: string, topic: sns.Topic, amountUsd: number): budgets.CfnBudget {
  // AWS Budgets publishes to the topic, so budget alerts arrive with every other notification.
  topic.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: 'AllowBudgets',
      principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
      actions: ['sns:Publish'],
      resources: [topic.topicArn],
    }),
  );
  const subscribers = [{ subscriptionType: 'SNS', address: topic.topicArn }];
  const notification = (threshold: number, notificationType: 'ACTUAL' | 'FORECASTED') => ({
    notification: { comparisonOperator: 'GREATER_THAN', notificationType, threshold, thresholdType: 'PERCENTAGE' },
    subscribers,
  });
  return new budgets.CfnBudget(scope, id, {
    budget: {
      budgetName: 'therapy-service-hours-monthly',
      budgetType: 'COST',
      timeUnit: 'MONTHLY',
      budgetLimit: { amount: amountUsd, unit: 'USD' },
    },
    notificationsWithSubscribers: [notification(80, 'ACTUAL'), notification(100, 'ACTUAL'), notification(100, 'FORECASTED')],
  });
}
