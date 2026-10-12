import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { devConfig, prodConfig } from '../config';
import { CONTENT_SECURITY_POLICY, contentSecurityPolicy } from '../lib/app/web';
import { buildStage } from './helpers';

function webTemplate(config = devConfig): Template {
  return Template.fromStack(buildStage(config).webStack);
}

type Behavior = Record<string, unknown>;

function distributionConfig(t: Template): { DefaultCacheBehavior: Behavior; CacheBehaviors: Behavior[]; CustomErrorResponses?: unknown } {
  const d = Object.values(t.findResources('AWS::CloudFront::Distribution'))[0] as { Properties: { DistributionConfig: never } };
  return d.Properties.DistributionConfig;
}

/** Runs the real CloudFront Function source against a request URI. */
function rewrite(uri: string): string {
  const source = readFileSync(join(__dirname, '..', 'lib', 'app', 'spa-rewrite.js'), 'utf8');
  const handler = new Function(`${source}; return handler;`)() as (e: { request: { uri: string } }) => { uri: string };
  return handler({ request: { uri } }).uri;
}

describe('SPA rewrite function (ADR-0004)', () => {
  test.each([
    ['/', '/index.html'],
    ['/schedules', '/index.html'],
    ['/entries/123', '/index.html'],
    ['/admin/users/', '/index.html'],
    ['/assets/index-CY6ekd8D.js', '/assets/index-CY6ekd8D.js'],
    ['/assets/inter-latin-400-normal.woff2', '/assets/inter-latin-400-normal.woff2'],
    ['/favicon.ico', '/favicon.ico'],
    ['/index.html', '/index.html'],
  ])('%s -> %s', (uri, expected) => {
    expect(rewrite(uri)).toBe(expected);
  });
});

describe('web (S0-12)', () => {
  test('the SPA bucket is private, TLS-only and encrypted (SEC-66)', () => {
    const t = webTemplate();
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      WebsiteConfiguration: Match.absent(),
    });
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
          Match.objectLike({ Effect: 'Allow', Action: 's3:GetObject', Principal: { Service: 'cloudfront.amazonaws.com' } }),
        ]),
      },
    });
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  test('prod keeps the bucket on stack deletion; dev empties and deletes it', () => {
    webTemplate(prodConfig).hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
    webTemplate(prodConfig).resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    webTemplate(devConfig).hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Delete' });
  });

  test('/api/* goes to API Gateway uncached with every viewer header except Host (ADR-0004)', () => {
    const cfg = distributionConfig(webTemplate());
    expect(cfg.CacheBehaviors).toHaveLength(1);
    expect(cfg.CacheBehaviors[0]).toMatchObject({
      PathPattern: '/api/*',
      ViewerProtocolPolicy: 'https-only',
      AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
      CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingDisabled
      OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac', // Managed-AllViewerExceptHostHeader
    });
    expect(cfg.CacheBehaviors[0]?.FunctionAssociations).toBeUndefined();
  });

  test('the SPA rewrite runs on the S3 behavior only, and there are no distribution-wide error pages (ARC-12)', () => {
    const cfg = distributionConfig(webTemplate());
    expect(cfg.DefaultCacheBehavior).toMatchObject({
      ViewerProtocolPolicy: 'redirect-to-https',
      FunctionAssociations: [{ EventType: 'viewer-request', FunctionARN: expect.anything() }],
    });
    expect(cfg.CustomErrorResponses).toBeUndefined();
  });

  test('the API origin is the HTTP API endpoint over TLS 1.2', () => {
    const json = JSON.stringify(webTemplate().findResources('AWS::CloudFront::Distribution'));
    expect(json).toContain('execute-api');
    expect(json).toContain('"OriginProtocolPolicy":"https-only"');
    expect(json).toContain('"OriginSSLProtocols":["TLSv1.2"]');
  });

  test('both behaviors send HSTS, nosniff, DENY framing, referrer policy and the CSP (SEC-31)', () => {
    const t = webTemplate();
    t.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: {
        SecurityHeadersConfig: {
          StrictTransportSecurity: { AccessControlMaxAgeSec: 31_536_000, IncludeSubdomains: true, Override: true },
          ContentTypeOptions: { Override: true },
          FrameOptions: { FrameOption: 'DENY', Override: true },
          ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
          ContentSecurityPolicy: { ContentSecurityPolicy: contentSecurityPolicy(devConfig), Override: true },
        },
      },
    });
    const cfg = distributionConfig(t);
    expect(cfg.DefaultCacheBehavior.ResponseHeadersPolicyId).toEqual(cfg.CacheBehaviors[0]?.ResponseHeadersPolicyId);
  });

  test('the CSP is self-only with no unsafe directives (SEC-32)', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  test('the SPA cache policy follows origin Cache-Control (index.html no-cache, hashed assets immutable)', () => {
    webTemplate().hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ MinTTL: 0, MaxTTL: 31_536_000 }),
    });
  });

  test('cheapest price class and no logging bucket (budget guard)', () => {
    const json = JSON.stringify(webTemplate().findResources('AWS::CloudFront::Distribution'));
    expect(json).toContain('PriceClass_100');
    expect(json).not.toContain('"Logging"');
  });
});
