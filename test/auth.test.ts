import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib/core';
import { devConfig, EnvConfig, prodConfig } from '../config';
import { buildStage, stacksOf, untaggedResources } from './helpers';

function enabledConfig(config: EnvConfig): EnvConfig {
  return { ...config, auth: { ...config.auth, enabled: true } };
}

function enabledStage(config: EnvConfig) {
  // Tests exercise the prepared resources; activation stays off in deploy config.
  return buildStage(enabledConfig(config), new App());
}

describe('Cognito activation safety (SEC-02)', () => {
  test.each([devConfig, prodConfig])('default $envName deployment has no auth resources or Google secret dependency', (config) => {
    expect(config.auth.enabled).toBe(false);
    const stage = buildStage(config);
    expect(stage.dataStack.auth).toBeUndefined();
    const template = Template.fromStack(stage.dataStack);
    for (const type of ['UserPool', 'UserPoolClient', 'UserPoolIdentityProvider', 'UserPoolDomain', 'UserPoolGroup']) {
      template.resourceCountIs(`AWS::Cognito::${type}`, 0);
    }
    expect(JSON.stringify(template.toJSON())).not.toContain(config.auth.googleSecretName);
  });

  test('prod rejects a password test client even if an incorrect config enables it', () => {
    expect(() => buildStage({ ...enabledConfig(prodConfig), auth: { ...prodConfig.auth, enabled: true, createPasswordTestClient: true } }))
      .toThrow(/forbidden in prod/);
  });

  test.each([
    { callbackUrls: [] },
    { callbackUrls: ['http://example.com/auth/callback'] },
    { callbackUrls: ['https://*.example.com/auth/callback'] },
    { callbackUrls: ['https://example.com/auth/callback#fragment'] },
    { callbackUrls: ['https://example.com/auth/callback?redirect=elsewhere'] },
    { logoutUrls: ['https://example.com/', 'https://example.com/'] },
    { logoutUrls: ['https://user:password@example.com/'] },
    { googleSecretName: '' },
    { googleClientSecretKey: devConfig.auth.googleClientIdKey },
    { domainPrefix: 'Bad_Domain' },
  ])('rejects invalid auth configuration %j', (override) => {
    expect(() => buildStage({ ...devConfig, auth: { ...devConfig.auth, ...override, enabled: true } })).toThrow();
  });
});

describe('Cognito identity and OAuth settings (S1-01)', () => {
  test.each([devConfig, prodConfig])('$envName auth belongs to data, has no stack cycle and carries mandatory tags', (config) => {
    const stage = enabledStage(config);
    expect(() => stage.synth()).not.toThrow();
    expect(untaggedResources(stage, ['app', 'env', 'owner'])).toEqual([]);
    const [data, app, web] = stacksOf(stage).map((stack) => Template.fromStack(stack));
    data.resourceCountIs('AWS::Cognito::UserPool', 1);
    app.resourceCountIs('AWS::Cognito::UserPool', 0);
    web.resourceCountIs('AWS::Cognito::UserPool', 0);
    data.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      AliasAttributes: ['email'],
      UsernameConfiguration: { CaseSensitive: false },
      UserPoolTier: 'LITE',
      DeletionProtection: config.auth.deletionProtection ? 'ACTIVE' : 'INACTIVE',
      Schema: Match.arrayWith([Match.objectLike({ Name: 'email', Required: true, Mutable: true })]),
    });
    data.resourceCountIs('AWS::Cognito::UserPoolGroup', 2);
    for (const group of ['admin', 'supervisor']) {
      data.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: group });
    }
    data.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      Domain: config.auth.domainPrefix,
      ManagedLoginVersion: 1,
    });
  });

  test('prod retains the pool on delete and replacement', () => {
    const template = Template.fromStack(enabledStage(prodConfig).dataStack);
    template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' });
  });

  test.each([devConfig, prodConfig])('$envName references two secret JSON fields and maps all Google identity attributes', (config) => {
    const template = Template.fromStack(enabledStage(config).dataStack);
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Google',
      ProviderType: 'Google',
      ProviderDetails: {
        client_id: `{{resolve:secretsmanager:${config.auth.googleSecretName}:SecretString:${config.auth.googleClientIdKey}::}}`,
        client_secret: `{{resolve:secretsmanager:${config.auth.googleSecretName}:SecretString:${config.auth.googleClientSecretKey}::}}`,
        authorize_scopes: 'openid email profile',
      },
      AttributeMapping: { email: 'email', email_verified: 'email_verified', given_name: 'given_name', family_name: 'family_name' },
    });
    // No fake credentials or extra secret created by this construct.
    template.resourceCountIs('AWS::SecretsManager::Secret', 0); // RDS manages its master secret.
  });

  test.each([devConfig, prodConfig])('$envName SPA is a Google-only public code client with approved token lifetimes', (config) => {
    const stage = enabledStage(config);
    const template = Template.fromStack(stage.dataStack);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: `therapy-service-hours-${config.envName}-spa`,
      GenerateSecret: false,
      SupportedIdentityProviders: ['Google'],
      AllowedOAuthFlows: ['code'],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 10080,
      TokenValidityUnits: { AccessToken: 'minutes', IdToken: 'minutes', RefreshToken: 'minutes' },
      EnableTokenRevocation: true,
      PreventUserExistenceErrors: 'ENABLED',
      CallbackURLs: [...config.auth.callbackUrls],
      LogoutURLs: [...config.auth.logoutUrls],
      ReadAttributes: ['email', 'email_verified', 'family_name', 'given_name'],
      WriteAttributes: ['email', 'family_name', 'given_name'],
    });
    const spa = Object.values(template.findResources('AWS::Cognito::UserPoolClient'))
      .find((resource) => resource.Properties.ClientName.endsWith('-spa'))!;
    expect(spa.Properties.WriteAttributes).not.toContain('email_verified');
    expect(spa.DependsOn).toContain(Object.keys(template.findResources('AWS::Cognito::UserPoolIdentityProvider'))[0]);
    template.hasOutput('*', { Value: stage.dataStack.resolve(stage.dataStack.auth!.googleRedirectUri) });
  });

  test('dev-only synthetic client supports password API auth but no OAuth login', () => {
    const template = Template.fromStack(enabledStage(devConfig).dataStack);
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 2);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'therapy-service-hours-dev-test-only',
      GenerateSecret: false,
      SupportedIdentityProviders: ['COGNITO'],
      AllowedOAuthFlowsUserPoolClient: false,
      ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      AllowedOAuthFlows: Match.absent(),
      CallbackURLs: Match.absent(),
      EnableTokenRevocation: true,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 10080,
    });
    const prodStage = enabledStage(prodConfig);
    expect(prodStage.dataStack.auth!.passwordTestClient).toBeUndefined();
    Template.fromStack(prodStage.dataStack).resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });
});
