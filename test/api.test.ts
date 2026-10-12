import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { buildStage } from './helpers';

function appTemplate(config = devConfig): Template {
  return Template.fromStack(buildStage(config).appStack);
}

describe('api (S0-11)', () => {
  test('the Go api Lambda runs on arm64 provided.al2023 in the VPC with reserved concurrency', () => {
    appTemplate().hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'therapy-service-hours-dev-api',
      Runtime: 'provided.al2023',
      Architectures: ['arm64'],
      Handler: 'bootstrap',
      MemorySize: 256,
      ReservedConcurrentExecutions: 20,
      VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue(), SecurityGroupIds: Match.anyValue() }),
    });
  });

  test('reserved concurrency x pool size stays under the db.t4g.micro connection budget (GO-40)', () => {
    const POOL_MAX_CONNS = 2; // internal/db.MaxConns
    const USABLE_CONNECTIONS = 80; // about 81 on db.t4g.micro after RDS reserved connections
    for (const config of [devConfig, prodConfig]) {
      expect(config.api.reservedConcurrency * POOL_MAX_CONNS).toBeLessThanOrEqual(USABLE_CONNECTIONS / 2);
    }
  });

  test('configuration comes from the environment, with no secret in it (GO-68, SEC-60)', () => {
    appTemplate().hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          APP_VERSION: 'placeholder',
          LOG_LEVEL: 'info',
          DB_HOST: Match.anyValue(),
          DB_PORT: Match.anyValue(),
          DB_NAME: 'therapy_service_hours',
          DB_USER: 'app_rw',
          DB_AUTH: 'iam',
        },
      },
    });
    expect(JSON.stringify(appTemplate().toJSON())).not.toMatch(/PASSWORD|secretsmanager/i);
  });

  test('the role may connect to the database only as app_rw (ADR-0001, SEC-64)', () => {
    const policies = Object.entries(appTemplate().findResources('AWS::IAM::Policy'))
      .filter(([id]) => id.startsWith('ApiFunctionServiceRoleDefaultPolicy')).map(([, policy]) => policy);
    const statements = policies.flatMap((p) => (p as { Properties: { PolicyDocument: { Statement: Record<string, unknown>[] } } }).Properties.PolicyDocument.Statement);
    const connect = statements.filter((s) => s.Action === 'rds-db:connect');
    expect(connect).toHaveLength(1);
    // RDS IAM auth needs arn:aws:rds-db:<region>:<account>:dbuser:<DbiResourceId>/<user>, with a colon after dbuser.
    const parts = JSON.stringify(connect[0]?.Resource);
    expect(parts).toContain(':rds-db:us-west-2:123456789012:dbuser:"');
    expect(parts).toContain('DbiResourceId');
    expect(parts).toContain('"/app_rw"');
    expect(parts).not.toContain('/presignup_ro');
    const json = JSON.stringify(appTemplate().toJSON());
    expect(json).not.toMatch(/"Resource":"\*"/);
    expect(json).not.toMatch(/dbuser:\*/);
  });

  test('one proxy route sends /api/v1/* to the Lambda; unknown paths are answered by the Go router', () => {
    const t = appTemplate();
    t.resourceCountIs('AWS::ApiGatewayV2::Route', 2);
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /api/v1/healthz', AuthorizationType: 'NONE' });
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'ANY /api/v1/{proxy+}' });
    t.hasResourceProperties('AWS::ApiGatewayV2::Integration', { IntegrationType: 'AWS_PROXY', PayloadFormatVersion: '2.0' });
  });

  test('the default stage throttles every route and logs without query strings (SEC-80, SEC-50)', () => {
    const t = appTemplate();
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      AutoDeploy: true,
      DefaultRouteSettings: Match.objectLike({ ThrottlingRateLimit: 50, ThrottlingBurstLimit: 100 }),
      AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
    });
    const format = JSON.stringify(t.findResources('AWS::ApiGatewayV2::Stage'));
    expect(format).toContain('$context.routeKey');
    expect(format).not.toMatch(/querystring|context\.path|identity\.sourceIp/i);
  });

  test.each([
    [devConfig, 14],
    [prodConfig, 30],
  ])('function and access logs keep the environment retention', (config, days) => {
    const t = appTemplate(config);
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: `/aws/lambda/therapy-service-hours-${config.envName}-api`, RetentionInDays: days });
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: `/aws/apigateway/therapy-service-hours-${config.envName}-api`, RetentionInDays: days });
  });

  test('no CORS configuration: the SPA calls the API on its own origin (ARC-03)', () => {
    const api = Object.values(appTemplate().findResources('AWS::ApiGatewayV2::Api'))[0] as { Properties: Record<string, unknown> };
    expect(api.Properties.CorsConfiguration).toBeUndefined();
  });
});
