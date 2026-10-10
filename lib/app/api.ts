import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib/core';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { denyLogGroupCreation } from './lambda-role';
import { EnvConfig } from '../../config';
import { LambdaArtifacts } from '../artifacts';
import { DATABASE_NAME } from './database';

/** Database role the API connects as (ADR-0001). Created by the role bootstrap (S0-08). */
export const API_DB_USER = 'app_rw';

/** Props for {@link Api}. */
export interface ApiProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  readonly artifacts: LambdaArtifacts;
  readonly vpc: ec2.IVpc;
  readonly appSecurityGroup: ec2.ISecurityGroup;
  readonly database: rds.IDatabaseInstance;
}

/**
 * The API (S0-11): API Gateway HTTP API → the Go `api` Lambda in the VPC (CLAUDE.md §4).
 *
 * - One proxy route, `ANY /api/v1/{proxy+}`, so the Go router (generated from the OpenAPI spec)
 *   owns routing and answers unknown paths with problem+json 404. The Cognito JWT authorizer is
 *   added by S1; until then only /healthz exists.
 * - Default stage throttling on every route (SEC-80) and JSON access logs without query strings
 *   (they can hold search terms, SEC-50).
 * - Reserved concurrency caps database connections (ADR-0001, SEC-81).
 * - The function may connect to RDS only as `app_rw` (SEC-64).
 */
export class Api extends Construct {
  readonly function: lambda.Function;
  readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const { config, prefix } = props;
    const stack = Stack.of(this);

    const fnLogs = new logs.LogGroup(this, 'FunctionLogs', {
      logGroupName: `/aws/lambda/${prefix}api`,
      retention: config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.function = new lambda.Function(this, 'Function', {
      functionName: `${prefix}api`,
      description: 'Therapy Service Hours API (Go)',
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: props.artifacts.code('api'),
      memorySize: config.api.memoryMiB,
      // Above the handler's own deadlines (GO-58, ARC-38); API Gateway itself stops at 30 s.
      timeout: Duration.seconds(15),
      reservedConcurrentExecutions: config.api.reservedConcurrency,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.appSecurityGroup],
      logGroup: fnLogs,
      environment: {
        APP_VERSION: props.artifacts.version,
        LOG_LEVEL: config.api.logLevel,
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_PORT: props.database.dbInstanceEndpointPort,
        DB_NAME: DATABASE_NAME,
        DB_USER: API_DB_USER,
        DB_AUTH: 'iam',
      },
    });
    denyLogGroupCreation(this.function, `/aws/lambda/${prefix}api`);

    // rds-db:connect for app_rw on this instance only (ADR-0001, SEC-64).
    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rds-db:connect'],
        resources: [
          stack.formatArn({
            service: 'rds-db',
            resource: 'dbuser',
            // arn:aws:rds-db:<region>:<account>:dbuser:<DbiResourceId>/app_rw
            resourceName: `${props.database.instanceResourceId}/${API_DB_USER}`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `${prefix}api`,
      description: 'Therapy Service Hours API (reached through CloudFront /api/*, ADR-0004)',
      createDefaultStage: false,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration('Api', this.function, {
        payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_2_0,
      }),
    });

    const accessLogs = new logs.LogGroup(this, 'AccessLogs', {
      logGroupName: `/aws/apigateway/${prefix}api`,
      retention: config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new apigwv2.HttpStage(this, 'DefaultStage', {
      httpApi: this.httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: config.api.throttle,
      accessLogSettings: {
        destination: new apigwv2.LogGroupLogDestination(accessLogs),
        // Route key and path only: no query string, headers or body (SEC-50).
        format: AccessLogFormat.custom(
          JSON.stringify({
            request_id: '$context.requestId',
            time: '$context.requestTime',
            method: '$context.httpMethod',
            route: '$context.routeKey',
            status: '$context.status',
            latency_ms: '$context.responseLatency',
            integration_status: '$context.integrationStatus',
            integration_error: '$context.integrationErrorMessage',
          }),
        ),
      },
    });
  }

  /** Host name of the HTTP API's default endpoint, for the CloudFront origin (S0-12). */
  get domainName(): string {
    return `${this.httpApi.apiId}.execute-api.${Stack.of(this).region}.${Stack.of(this).urlSuffix}`;
  }
}
