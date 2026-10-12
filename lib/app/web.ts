import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Duration } from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config';

/**
 * Content-Security-Policy (SEC-31, SEC-32). Everything is self-hosted: scripts, styles and fonts.
 * No 'unsafe-inline' or 'unsafe-eval'. connect-src gains the Cognito hosted-UI domain in S1.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/** Fixed Cognito origin from reviewed config; no wildcard or cross-stack token is needed. */
export function hostedUiOrigin(config: EnvConfig): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.auth.domainPrefix)) throw new Error('Invalid Cognito domain prefix');
  return `https://${config.auth.domainPrefix}.auth.${config.region}.amazoncognito.com`;
}

export function contentSecurityPolicy(config: EnvConfig): string {
  return CONTENT_SECURITY_POLICY.replace("connect-src 'self'", `connect-src 'self' ${hostedUiOrigin(config)}`);
}

/** Props for {@link Web}. */
export interface WebProps {
  readonly config: EnvConfig;
  readonly prefix: string;
  /** Host name of the HTTP API's default endpoint (`<id>.execute-api.<region>.amazonaws.com`). */
  readonly apiDomainName: string;
}

/**
 * SPA hosting and the single public entry point (S0-12, ADR-0004).
 *
 * - Private S3 bucket (Block Public Access, TLS only, SSE-S3), readable only by CloudFront via OAC.
 * - One CloudFront distribution: the bucket as the default behavior, `/api/*` to API Gateway with
 *   caching disabled and every viewer header except Host forwarded (so `Authorization` reaches the
 *   JWT authorizer). Same origin, so no CORS (ARC-03).
 * - SPA routing by a CloudFront Function on the S3 behavior only. There are deliberately no
 *   distribution-wide error responses, which would turn API 403/404 into index.html (ARC-12).
 * - One response headers policy for both behaviors: HSTS, nosniff, DENY framing,
 *   strict-origin-when-cross-origin and the CSP above (SEC-31).
 * - Caching follows the origin's Cache-Control: the deploy uploads hashed assets as immutable for a
 *   year and index.html as no-cache (ARC-42, S0-15). API responses are never cached.
 */
export class Web extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id);
    const { config, prefix } = props;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: false,
      removalPolicy: config.web.bucketRemovalPolicy,
      autoDeleteObjects: config.web.autoDeleteObjects,
    });

    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      functionName: `${prefix}spa-rewrite`,
      comment: 'Rewrite extensionless paths to /index.html (ADR-0004)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(readFileSync(join(__dirname, 'spa-rewrite.js'), 'utf8')),
    });

    const headers = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `${prefix}security-headers`,
      comment: 'Security headers for the SPA and the API (SEC-31)',
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: contentSecurityPolicy(config), override: true },
      },
    });

    // Honors the Cache-Control set at upload (min TTL 0), so index.html: no-cache works.
    const spaCache = new cloudfront.CachePolicy(this, 'SpaCache', {
      cachePolicyName: `${prefix}spa-cache`,
      comment: 'Follow origin Cache-Control; compress',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${prefix}web`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: spaCache,
        responseHeadersPolicy: headers,
        compress: true,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(props.apiDomainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headers,
          compress: true,
        },
      },
    });
  }
}
