import { describe, expect, test } from 'vitest';
import { Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { buildStage } from './helpers';
import { contentSecurityPolicy, hostedUiOrigin } from '../lib/app/web';
import { App } from 'aws-cdk-lib/core';
import { PipelineStack } from '../lib/pipeline/pipeline-stack';
import { placeholderArtifacts } from '../lib/artifacts';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';

describe('prepared Gateway authentication', () => {
  test.each([devConfig, prodConfig])('$envName has exactly one public route when enabled', (config) => {
    const stage = buildStage({ ...config, auth: { ...config.auth, enabled: true } });
    const app = Template.fromStack(stage.appStack);
    const routes = Object.values(app.findResources('AWS::ApiGatewayV2::Route'));
    expect(routes.filter((r) => r.Properties.AuthorizationType === 'NONE').map((r) => r.Properties.RouteKey)).toEqual(['GET /api/v1/healthz']);
    const proxy = routes.find((r) => r.Properties.RouteKey === 'ANY /api/v1/{proxy+}');
    expect(proxy?.Properties.AuthorizationType).toBe('JWT');
    expect(proxy?.Properties.AuthorizerId).toBeDefined();
    const authorizers = Object.values(app.findResources('AWS::ApiGatewayV2::Authorizer'));
    expect(authorizers).toHaveLength(1);
    const authorizer = authorizers[0].Properties;
    expect(authorizer.IdentitySource).toEqual(['$request.header.Authorization']);
    expect(JSON.stringify(authorizer.JwtConfiguration.Issuer)).toContain('https://cognito-idp.us-west-2.amazonaws.com/');
    expect(authorizer.JwtConfiguration.Audience).toHaveLength(config.envName === 'dev' ? 2 : 1);
  });

  test('CSP allows only the exact configured Cognito origin for connections', () => {
    const csp = contentSecurityPolicy(devConfig);
    expect(csp).toContain(`connect-src 'self' ${hostedUiOrigin(devConfig)}`);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(() => hostedUiOrigin({ ...devConfig, auth: { ...devConfig.auth, domainPrefix: "bad; script-src *" } })).toThrow();
  });

  test('the enabled release graph synthesizes public settings and scoped smoke credentials', () => {
    // Exercise activation-only branches without changing the committed deployment defaults.
    const enabled = devConfig.auth.enabled;
    Object.assign(devConfig.auth, { enabled: true });
    try {
      const app = new App();
      const pipeline = new PipelineStack(app, 'PreparedAuth', { env: { account: PLACEHOLDER_ACCOUNT, region: devConfig.region }, account: PLACEHOLDER_ACCOUNT, artifacts: placeholderArtifacts(), notificationEmail: 'owner@example.invalid', deployProd: false, monthlyBudgetUsd: 50 });
      const template = Template.fromStack(pipeline);
      const projects = JSON.stringify(template.findResources('AWS::CodeBuild::Project'));
      expect(projects).toContain('write_auth_config.py');
      expect(projects).toContain('auth_smoke.py');
      const release = JSON.stringify(template.toJSON());
      expect(release).toContain('SMOKE_READER_ROLE_ARN');
      expect(release).toContain('SPA_CLIENT_ID');
      expect(projects).not.toContain('client_secret');
      const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
      expect(policies).toContain('sts:AssumeRole');
      expect(policies).toContain('smoke-reader');
      app.synth();
    } finally { Object.assign(devConfig.auth, { enabled }); }
  });
});
