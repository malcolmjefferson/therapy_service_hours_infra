# ADR-0009: The user pool lives in the data stack; callback URLs come from config

- **Status:** Proposed · **Date:** 2026-10-11 · **Deciders:** project owner
- **Related:** FR-AUTH-01, FR-AUTH-03, NFR-SEC-04, ARC-27 · Tickets: S1-01, S1-16

## Context

S1-01 as written puts the Cognito auth construct in the app stack and takes its callback URLs "from
the CloudFront domain". Two problems follow from the stack graph S0 already built.

- **It is circular.** `lib/app-stage.ts:46-51` makes `WebStack` depend on `AppStack`, because
  CloudFront needs the API Gateway domain for its `/api/*` behavior. Putting the pool in the app
  stack and feeding it the CloudFront domain adds an `App → Web` reference on top of the existing
  `Web → App` dependency, and `cdk synth` fails with a cyclic stack dependency.
- **It is in the wrong stack.** ARC-27 splits stateful resources (data stack) from stateless ones
  (app stack: Lambdas, API Gateway, triggers). A user pool is stateful: it holds the Google identity
  links, and every `users.cognito_sub` in the database points into it. If the pool is ever replaced,
  every binding goes stale and nobody can sign in.

ADR-0004 anticipated half of this — *"the Cognito redirect URI depends on the CloudFront domain,
known only after first deploy (ticket S1-01 documents this ordering)"* — but documenting an ordering
does not resolve a synth-time cycle.

## Decision

- The **user pool, its groups, the Google identity provider and the app clients live in the data
  stack**, deployed before the app stack, with `RemovalPolicy.RETAIN` in prod.
- **Callback and logout URLs are plain configuration** in `EnvConfig`, not a cross-stack reference.
  Dev uses the CloudFront domain that already exists (`https://dx5eaoy4duyuy.cloudfront.net`, infra
  `STATUS.md`); prod carries documented synth-valid placeholders until M3, because `bin/app.ts:25-31`
  synthesizes both environments on every build even while `RELEASE.deployProd` is off.
- The **pre-sign-up trigger stays in the app stack** and is attached to the pool from there, so the
  only cross-stack reference is app → data, the direction that already exists.
- **Two Google OAuth clients and two Secrets Manager secrets**, one per environment, because
  Google's authorized redirect URI is per client and points at one pool's hosted-UI
  `/oauth2/idpresponse`.
- The runbook gains a **re-bind procedure**: if a pool is ever replaced, clear `users.cognito_sub`
  and let the next sign-in re-bind by email (ADR-0008), rather than editing identities by hand.

## Alternatives considered

| Option | Why not |
|---|---|
| Pool in the app stack, CloudFront domain passed in | Cyclic stack dependency; synth fails. |
| Pool in a fourth stack after Web | Works, but adds a stack and a deploy step to the pipeline for one construct, and still needs the URL in config to avoid a cycle on the trigger. |
| Wildcard or placeholder callback URL resolved at runtime | Cognito requires exact callback URLs; a wildcard is not allowed and would be a redirect risk if it were. |
| Keep the pool stateless and accept re-creation | Every `cognito_sub` binding would break on replacement, with no documented recovery. |

## Consequences

**Positive:** no cycle, the stateful resource sits in the stateful stack with a retain policy, synth
works for both environments while prod is deferred, and the recovery path is written down.
**Negative:**
- The CloudFront domain is duplicated in config rather than derived, so changing distributions means
  a config PR. Acceptable: the domain is stable and changing it is already a user-visible event.
- Prod's placeholders are a known lie until M3; the M3 checklist has to replace them, and S1-01's
  acceptance criteria say so rather than pretending prod is configured.

**Cost:** $0.

## Validation

- `npx cdk synth dev` and `npx cdk synth prod` both succeed with the pool in place.
- A deploy of the data stack creates the pool; the app stack then attaches the trigger.
- Runbook: the re-bind procedure is written and marked as (rehearse) until exercised.

## Open items

- Replace prod's placeholder URLs and create the prod Google client as part of the M3 checklist.
