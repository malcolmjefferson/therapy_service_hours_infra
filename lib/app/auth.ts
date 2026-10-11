import {
  CfnUserPoolGroup,
  ClientAttributes,
  FeaturePlan,
  ManagedLoginVersion,
  OAuthScope,
  ProviderAttribute,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolDomain,
  UserPoolIdentityProviderGoogle,
} from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, Duration, SecretValue } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { EnvConfig } from '../../config';

export interface AuthProps {
  readonly config: EnvConfig;
  readonly prefix: string;
}

/** Stateful identity resources; callback URLs never reference the web stack (ADR-0009). */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly spaClient: UserPoolClient;
  readonly passwordTestClient?: UserPoolClient;
  readonly domain: UserPoolDomain;
  readonly hostedUiOrigin: string;
  readonly googleRedirectUri: string;
  readonly userPoolIdOutput: CfnOutput;
  readonly testClientIdOutput?: CfnOutput;
  readonly testSecretArnOutput?: CfnOutput;
  readonly testCredentials?: Secret;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);
    const settings = props.config.auth;
    validateSettings(props.config);
    this.userPool = new UserPool(this, 'Pool', {
      userPoolName: `${props.prefix}users`,
      featurePlan: FeaturePlan.LITE,
      selfSignUpEnabled: false,
      signInAliases: { username: true, email: true },
      signInCaseSensitive: false,
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { mutable: true },
        familyName: { mutable: true },
      },
      removalPolicy: settings.removalPolicy,
      deletionProtection: settings.deletionProtection,
    });
    // S1-03 attaches its trigger from the app stack (ADR-0009). Do not reference an
    // app-stack Lambda here: it would create a data -> app -> data dependency cycle.
    for (const groupName of ['admin', 'supervisor']) {
      new CfnUserPoolGroup(this, `${groupName}Group`, { userPoolId: this.userPool.userPoolId, groupName });
    }
    const google = new UserPoolIdentityProviderGoogle(this, 'Google', {
      userPool: this.userPool,
      // CDK expects a string for this public identifier; unwrap only the unresolved
      // Secrets Manager reference, never retrieve the secret during synth (SEC-60).
      clientId: SecretValue.secretsManager(settings.googleSecretName, { jsonField: settings.googleClientIdKey }).unsafeUnwrap(),
      clientSecretValue: SecretValue.secretsManager(settings.googleSecretName, { jsonField: settings.googleClientSecretKey }),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });
    const writeAttributes = new ClientAttributes().withStandardAttributes({ email: true, givenName: true, familyName: true });
    // Verification flags are read-only to clients; Google supplies their mapped values.
    const readAttributes = writeAttributes.withStandardAttributes({ emailVerified: true });
    const tokenSettings = {
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(7),
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      generateSecret: false,
    };
    this.spaClient = this.userPool.addClient('SpaClient', {
      ...tokenSettings,
      userPoolClientName: `${props.prefix}spa`,
      supportedIdentityProviders: [UserPoolClientIdentityProvider.GOOGLE],
      authFlows: { userPassword: false, userSrp: false, custom: false, adminUserPassword: false },
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: false },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: [...settings.callbackUrls],
        logoutUrls: [...settings.logoutUrls],
      },
      readAttributes,
      writeAttributes,
    });
    this.spaClient.node.addDependency(google);
    if (settings.createPasswordTestClient) {
      this.passwordTestClient = this.userPool.addClient('PasswordTestClient', {
        ...tokenSettings,
        userPoolClientName: `${props.prefix}test-only`,
        supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
        disableOAuth: true,
        authFlows: { userPassword: true, userSrp: false, custom: false, adminUserPassword: false },
        readAttributes,
        writeAttributes,
      });
      this.testClientIdOutput = new CfnOutput(this, 'PasswordTestClientId', { value: this.passwordTestClient.userPoolClientId });
      this.testCredentials = new Secret(this, 'TestCredentials', {
        secretName: `${props.prefix}auth-test-users`, removalPolicy: settings.removalPolicy,
        description: 'Generated dev-only password for the three fixed synthetic accounts (ADR-0011)',
        generateSecretString: { secretStringTemplate: '{}', generateStringKey: 'password', passwordLength: 32, requireEachIncludedType: true },
      });
      this.testSecretArnOutput = new CfnOutput(this, 'TestCredentialsArn', { value: this.testCredentials.secretArn });
    }
    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: settings.domainPrefix },
      managedLoginVersion: ManagedLoginVersion.CLASSIC_HOSTED_UI,
    });
    this.hostedUiOrigin = this.domain.baseUrl();
    this.googleRedirectUri = `${this.hostedUiOrigin}/oauth2/idpresponse`;
    this.userPoolIdOutput = new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'SpaClientId', { value: this.spaClient.userPoolClientId });
    new CfnOutput(this, 'HostedUiOrigin', { value: this.hostedUiOrigin });
    new CfnOutput(this, 'GoogleRedirectUri', { value: this.googleRedirectUri });
  }
}

function validateSettings(config: EnvConfig): void {
  const settings = config.auth;
  if (config.envName === 'prod' && settings.createPasswordTestClient) {
    throw new Error('The password test client is forbidden in prod (ADR-0011)');
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(settings.domainPrefix)) {
    throw new Error('Cognito domainPrefix must be a DNS label');
  }
  if (
    !settings.googleSecretName.trim() ||
    !settings.googleClientIdKey.trim() ||
    !settings.googleClientSecretKey.trim() ||
    settings.googleClientIdKey === settings.googleClientSecretKey
  ) {
    throw new Error('Google credentials require a secret name and two distinct JSON keys');
  }
  for (const urls of [settings.callbackUrls, settings.logoutUrls]) {
    if (urls.length === 0 || new Set(urls).size !== urls.length) {
      throw new Error('Cognito callback/logout URLs must be nonempty and unique');
    }
    for (const value of urls) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.hostname.includes('*')) {
        throw new Error('Cognito callback/logout URLs must be exact HTTPS URLs without credentials, query or fragment');
      }
    }
  }
}
