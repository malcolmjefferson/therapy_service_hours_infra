# Google OAuth setup (S1-01)

**State: AWS credential setup verified; Cognito not deployed.** On 2026-10-11 the owner
reported Google OAuth setup complete. AWS checks confirmed the dev secret
`therapy-service-hours/dev/google-oauth` exists in `us-west-2`, is not scheduled for deletion,
and has an `AWSCURRENT` version. That version contains exactly `client_id` and `client_secret`,
both nonempty strings; the ID has Google's expected `.apps.googleusercontent.com` suffix.
Values were inspected only in memory and were never printed. The supplied `thrapy-...` spelling
was not found; the existing `therapy-...` name already matches config. Google console settings
and credential validity are not proved by these structural checks. Google sign-in succeeded,
but console navigation repeatedly returned to sign-in, blocking independent redirect/scope review.
Both environments have `auth.enabled: false`; merging this preparation creates no
Cognito resources and makes no Google secret lookup. S1-01 stays in progress until activation and
deployment verification finish. The owner creates the Google client; credential values never
belong in chat, Git, CDK context, logs or the SPA bundle.

## Dev settings

| Setting | Value |
|---|---|
| AWS region | `us-west-2` |
| Secrets Manager name | `therapy-service-hours/dev/google-oauth` |
| JSON fields | `client_id`, `client_secret` |
| Cognito domain prefix | `therapy-service-hours-dev-malcolmjefferson` |
| Google authorized JavaScript origin | `https://therapy-service-hours-dev-malcolmjefferson.auth.us-west-2.amazoncognito.com` |
| Google authorized redirect URI | `https://therapy-service-hours-dev-malcolmjefferson.auth.us-west-2.amazoncognito.com/oauth2/idpresponse` |
| SPA callback | `https://dx5eaoy4duyuy.cloudfront.net/auth/callback` |
| SPA logout URL | `https://dx5eaoy4duyuy.cloudfront.net/` |

These are two separate redirects: Google returns to Cognito's `/oauth2/idpresponse`; Cognito
returns to the SPA's `/auth/callback`. Domain availability is verified at deployment. If the
prefix is unavailable, change it in config and Google together before deploying.

## Owner setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create the
   project. In **Google Auth Platform**, complete the app name, support/contact email and
   External audience setup. Keep dev in Testing. Use only the basic identity scopes:
   `openid`, email and profile. Add the demo Google accounts under Audience test users if the
   console requests them; include the invited and uninvited accounts for S1-18.
2. In **Clients**, create a **Web application** named `therapy-service-hours-dev`. Register
   the exact origin and Google redirect URI in the table. The client is for Cognito's server
   exchange, even though the application itself is a SPA. Follow the current
   [AWS Google registration instructions](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp-google.html).
3. Immediately copy the displayed client ID and secret into **AWS Secrets Manager**, region
   `us-west-2`: choose **Other type of secret**, add the two key/value pairs `client_id` and
   `client_secret`, use the AWS-managed Secrets Manager encryption key, and save as
   `therapy-service-hours/dev/google-oauth`. Do not turn on automatic rotation: Google client
   rotation is a coordinated manual operation. Google shows new client secrets only at creation;
   see [Google credential storage guidance](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).
4. Report only that setup is complete and the secret name/key names. If a different name was
   used, change `config/dev.ts` in a PR. Never paste values into a ticket or chat. A metadata
   check can use `aws secretsmanager describe-secret --secret-id therapy-service-hours/dev/google-oauth --region us-west-2`;
   it does not return secret contents.

CDK emits deployment-time Secrets Manager dynamic references for both fields. It never
retrieves the values during synth and does not create a secret containing dummy credentials.
The CloudFormation execution role must be allowed to resolve this secret. There is no
`GetSecretValue` permission added to a VPC Lambda.

## Activation and verification

Keep `auth.enabled` false until the Google secret exists and **S1-03** implements the
invitation allowlist attachment. Disabling native self-sign-up alone does not block first
Google sign-in (SEC-02). The attachment must be owned by the app stack, with app → data
references only (ADR-0009). Calling `userPool.addTrigger` with an app-stack Lambda mutates
the data-stack pool and creates a reverse dependency; S1-03 must use an app-owned attachment
and test the complete stack graph. Do not activate this preparation by itself.

Review the activation PR against S1-03, S1-14 (JWT authorizer), S1-09 (admin/test seed),
S1-16 (CSP) and S1-10 (SPA callback). Run the pipeline through data, migration, app and web;
then verify pool/client/domain outputs, Google attribute mapping, the allowlist, authorizer
and callback against the deployed resources. S1-18 records invited/uninvited/deactivated
Google sign-ins and measured trigger latency; automated password tests do not replace that demo.

The SPA client is public, Google-only and supports authorization code grants. Cognito's
client configuration enables the code flow; **S1-10 must send a fresh S256 PKCE challenge,
validate state and exchange with the verifier**. There is no CDK setting that makes this
preparation a complete PKCE implementation. Access/ID tokens last 60 minutes, refresh tokens
7 days, with revocation enabled. Email verification is mapped from Google and readable in
tokens; it is not writable by clients. Database roles remain the authorization authority.

## Feature choice and monthly cost

Use **Cognito Lite** and **classic hosted UI** (domain `ManagedLoginVersion: 1`). Google
federation and the code flow do not need the newer managed login or Essentials features.
For direct/social sign-in, Lite includes 10,000 MAUs per month across the account or AWS
organization; expected small-project usage therefore adds **$0/month for Cognito** within
that allowance. Usage over the allowance is chargeable; check Cost Explorer monthly against
the $50 project budget. See [Cognito pricing](https://aws.amazon.com/cognito/pricing/).

The Google credential secret adds **$0.40/month per environment**, plus API calls (two
secrets: approximately $0.80/month), separate from the existing RDS master secret. See
[Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/). The approved
pre-sign-up provisioned concurrency cost remains approximately $1–3/month (ADR-0007).
This disabled preparation creates none of these new resources.

## Prod at M3

Prod has a separate Google client and `therapy-service-hours/prod/google-oauth` with the same
JSON key names. Its redirect URI uses the prod prefix from `config/prod.ts`. Replace the
`prod-not-enabled.example.invalid` callback/logout URLs with the real deployed CloudFront
origin before activation. Keep `RELEASE.deployProd: false` until M3. The prod pool is retained
on deletion/replacement, deletion protection is on, and the password test client is forbidden.

## Reviewer checks

Run `npm run typecheck`, `npm test` and `npm run synth` without deployment credentials.
`test/auth.test.ts` synthesizes enabled dev/prod configurations in memory to inspect the
prepared resources and verify the data/app/web graph. Default deploy config synthesizes no
Cognito resources or Google secret dependency. These checks do not prove live federation;
the manual verification above remains outstanding.
