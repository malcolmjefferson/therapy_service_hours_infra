# ADR-0011: Automated sign-in tests use a dev-only password app client

- **Status:** Proposed · **Date:** 2026-10-11 · **Deciders:** project owner
- **Related:** FR-AUTH-01, FR-AUTH-06, SEC-01, SEC-45 · Tickets: S1-02, S1-09, S1-13, S1-14

## Context

S1-13 books two days to run Playwright against dev: an invited user signs in and sees their name, an
uninvited user sees the access-denied page. Sign-in is **Google only** (SEC-01), so the test would
have to drive `accounts.google.com`. That is not a thing to build a release gate on: consent
re-prompts, bot detection and device checks all change without notice, and Google's terms discourage
it. Self sign-up is disabled, so there is no native user to fall back on either.

The same problem reappears one layer down. Once the JWT authorizer is attached (S1-14), any smoke
check of a protected route needs a token, and `scripts/smoke.sh` has no way to get one.

## Decision

Dev gets a **second, password-based app client that exists only in dev**, used by tests and nothing
else:

- A `dev-test` app client on the same user pool with `USER_PASSWORD_AUTH` enabled. It is created from
  `EnvConfig`, so prod's config simply does not have it, and a synth test asserts prod declares no
  password-auth client.
- Two or three **native test users** (`test-invited`, `test-uninvited`, later `test-supervisor`),
  created by a **non-VPC pipeline step** in the dev stage, because Cognito admin APIs are not
  reachable from inside the VPC (CLAUDE.md §4.1, the same constraint ADR-0002 solves for admin
  actions). Their passwords are generated at creation and stored in Secrets Manager; nothing is
  committed (SEC-45).
- Their **invitations and `users` rows** come from the VPC seed Lambda's dev-only path (S1-09), so
  the invited test user has a row to bind to and the uninvited one deliberately has neither.
- Playwright signs in through that client to obtain a token, and the Google hosted-UI path is covered
  by a **recorded manual demo** for the slice, which the slice Definition of Done already allows
  ("performed on dev by someone other than the author, **or recorded**").
- `smoke.sh` gains an authenticated check of one protected route using the same credentials, so the
  release gate proves the authorizer works rather than only that `/healthz` is public.

This is an explicit, recorded **deviation from SEC-01**: the pool accepts a password flow for
synthetic users in dev only. Real users, in either environment, still have no password and no way to
create one.

## Alternatives considered

| Option | Why not |
|---|---|
| Drive Google's consent screen in Playwright | Unreliable by design; a release gate that fails for reasons outside the project. |
| A dedicated Google test account with a stored refresh token | Trades flakiness for a long-lived credential that cannot be rotated automatically, and still breaks on Google's re-consent prompts. |
| Mock the authorizer in dev | The thing under test is the authorizer; mocking it tests nothing and risks the mock reaching prod. |
| Client-credentials machine token | Carries no user identity, so the middleware would reject it; it would need a second code path in the auth middleware, which is the last place to add one. |
| Manual demo only, no automated sign-in test at all | Acceptable for S1 but leaves every later slice's E2E without a token, pushing the same problem to S2. |

## Consequences

**Positive:** E2E and smoke tests can get a real token from the real pool; no third-party UI in the
release path; the deviation is scoped to dev and asserted in synth.
**Negative:**
- A password flow exists on the dev pool, so the dev pool is not a faithful copy of prod. The synth
  test and the config-only switch keep that from drifting.
- Test credentials live in Secrets Manager and have to be rotated if dev is rebuilt; the runbook
  records it.
- The federated path itself is covered manually in S1, and automated only if the owner later accepts
  a Google test account.

**Cost:** $0.

## Validation

- S1-13: both paths pass in the dev smoke stage using the dev-test client, or the manual demo is
  recorded and the rest is automated.
- A synth test asserts prod has no password-auth app client and no test users.
- `smoke.sh`: one authenticated request against a protected route returns 200 on dev.

## Open items

- Decide whether the same client is reused for performance testing in S11 or a separate load user is
  created.
