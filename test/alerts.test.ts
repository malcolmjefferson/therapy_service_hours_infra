import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { ALARM_THRESHOLDS } from '../lib/app/alerts';
import { buildStage } from './helpers';

function templates(config = devConfig): { data: Template; app: Template } {
  const stage = buildStage(config);
  return { data: Template.fromStack(stage.dataStack), app: Template.fromStack(stage.appStack) };
}

function alarm(t: Template, name: string): Record<string, unknown> {
  const found = Object.values(t.findResources('AWS::CloudWatch::Alarm', { Properties: { AlarmName: name } }));
  expect(found, `alarm ${name}`).toHaveLength(1);
  return (found[0] as { Properties: Record<string, unknown> }).Properties;
}

describe('alerts (S0-18)', () => {
  test.each([devConfig, prodConfig])('$envName: an alert topic emails the owner over TLS', (config) => {
    const { data } = templates(config);
    data.hasResourceProperties('AWS::SNS::Topic', { TopicName: `therapy-service-hours-${config.envName}-alerts` });
    data.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'malcolmj0415@gmail.com' });
    data.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]) },
    });
  });

  test('RDS alarms: CPU, free storage and connections, with the documented thresholds', () => {
    const { data } = templates();
    expect(alarm(data, 'therapy-service-hours-dev-rds-cpu')).toMatchObject({
      MetricName: 'CPUUtilization', Threshold: ALARM_THRESHOLDS.rdsCpuPercent, EvaluationPeriods: 3, Period: 300,
      ComparisonOperator: 'GreaterThanThreshold', TreatMissingData: 'notBreaching',
    });
    expect(alarm(data, 'therapy-service-hours-dev-rds-free-storage')).toMatchObject({
      MetricName: 'FreeStorageSpace', Threshold: 2 * 1024 ** 3, ComparisonOperator: 'LessThanThreshold', Statistic: 'Minimum',
    });
    expect(alarm(data, 'therapy-service-hours-dev-rds-connections')).toMatchObject({
      MetricName: 'DatabaseConnections', Threshold: 60, EvaluationPeriods: 2, Statistic: 'Maximum',
    });
  });

  test('API alarms: 5xx, Lambda errors and throttles', () => {
    const { app } = templates();
    expect(alarm(app, 'therapy-service-hours-dev-api-5xx')).toMatchObject({ MetricName: '5xx', Namespace: 'AWS/ApiGateway', Threshold: 5 });
    expect(alarm(app, 'therapy-service-hours-dev-api-lambda-errors')).toMatchObject({ MetricName: 'Errors', Namespace: 'AWS/Lambda', Threshold: 5 });
    expect(alarm(app, 'therapy-service-hours-dev-api-lambda-throttles')).toMatchObject({ MetricName: 'Throttles', Threshold: 1 });
  });

  test('every alarm notifies the alert topic on ALARM and on OK', () => {
    const { data, app } = templates();
    for (const t of [data, app]) {
      for (const a of Object.values(t.findResources('AWS::CloudWatch::Alarm'))) {
        const props = (a as { Properties: { AlarmActions: unknown[]; OKActions: unknown[] } }).Properties;
        expect(props.AlarmActions).toHaveLength(1);
        expect(props.OKActions).toHaveLength(1);
        expect(JSON.stringify(props.AlarmActions)).toMatch(/AlertsTopic/);
      }
    }
  });

  test.each([devConfig, prodConfig])('$envName: no budget in the environment (account-wide, in the pipeline stack)', (config) => {
    templates(config).data.resourceCountIs('AWS::Budgets::Budget', 0);
  });
});
