# ADR-0004: CloudFront same-origin `/api/*` routing

- **Status:** Accepted · **Date:** 2026-10-09 (accepted 2026-10-10) · **Deciders:** project owner
- **Related:** NFR-SEC-04, NFR-SEC-05, FR-AUTH-06 · Tickets: S0-12, S0-20

## Context

The SPA is on S3 behind CloudFront. The API is an API Gateway HTTP API. The public URL is the default `*.cloudfront.net` name (no custom domain yet). Two origins in the browser mean CORS configuration, preflight latency, and two places to set security headers.

## Decision

- One CloudFront distribution with **two origins**: the S3 bucket (private, **OAC**) as default behavior, and the API Gateway endpoint for the behavior **`/api/*`** (caching disabled, all methods, forward `Authorization`, origin request policy that excludes the `Host` header).
- The SPA calls `/api/v1/...` on its own origin: **no CORS**. API Gateway CORS is left unconfigured.
- **SPA client-side routing** is handled by a **CloudFront Function** on the default (S3) behavior only: viewer requests for paths without a file extension are rewritten to `/index.html`. Distribution-wide custom error responses (403/404 → `index.html`) are **not** used because they would also rewrite API 403/404 responses.
- A **response headers policy** sets `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, and a **CSP** (`default-src 'self'`; `connect-src 'self'` plus the Cognito hosted-UI domain; `img-src 'self' data:`; fonts self-hosted).
- Cache: hashed assets `Cache-Control: public, max-age=31536000, immutable`; `index.html` `no-cache`. Deploy invalidates `/index.html` only.
- Origin protection: API Gateway is still reachable at its own URL; the Cognito JWT authorizer is the control. An origin-verify header is **not** added in v1 (would need a custom authorizer or WAF); accepted risk, noted in the runbook.

## Alternatives considered

| Option | Why not |
|---|---|
| Separate API origin with CORS | Extra config, preflights, second set of headers. |
| ALB in front of Lambda | Disallowed by budget guard. |
| Custom error responses for SPA routing | Rewrites `/api/*` errors to HTML. |
| Hash-based routing (`/#/...`) | Awkward URLs for shareable schedule links. |

## Consequences

**Positive:** one origin, simpler auth flow, strict CSP, shareable deep links.
**Negative:** CloudFront Function must be tested; API Gateway still publicly addressable; the Cognito redirect URI depends on the CloudFront domain, known only after first deploy (ticket S1-01 documents this ordering).
**Cost:** CloudFront and Functions within free tier at this scale.

## Validation

- E2E: deep link `/schedules?user=…` loads the SPA; `/api/v1/healthz` returns JSON, not HTML; an unknown `/api/v1/x` returns problem+json 404, not `index.html`.
- Header scan (S0-20): all headers present on the SPA response.
- No CORS headers needed; a cross-origin request from another site is refused by the browser and has no credentials anyway.

## Open items

- When a custom domain is added, revisit WAF/origin-verify.
