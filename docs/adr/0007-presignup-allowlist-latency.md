# ADR-0007: Pre-sign-up allowlist inside the VPC, with a measured latency budget

- **Status:** Accepted · **Date:** 2026-10-11 (accepted 2026-10-11) · **Deciders:** project owner
- **Related:** FR-AUTH-01, FR-AUTH-05, SEC-02, NFR-COST-01 · Tickets: S1-03, S1-17, S1-18

## Context

FR-AUTH-01 and SEC-02 make sign-up invite-only through a Cognito **pre-sign-up trigger** that
rejects any email without an invitation. The invitations live in RDS PostgreSQL, in private subnets
with no NAT, so the trigger has to run inside the VPC to read them.

Cognito's synchronous Lambda triggers have a **fixed 5-second timeout** that cannot be raised. If the
trigger does not answer in time, Cognito fails the sign-up, which to the user is a refused sign-in.

This project already has evidence that a cold VPC Lambda cannot be trusted to connect to RDS inside
five seconds:

- `internal/db/pool.go:30` sets `IAMConnectTimeout = 12 * time.Second`.
- `internal/db/token_test.go:204` asserts that timeout must be **above 5 seconds**.
- The backend's `STATUS.md` records why (S0-09): *"IAM connect timeout raised to 12 s after the
  first pipeline run (RDS auth proxy slow on first use)."*

So the default shape of S1-03 — a cold VPC Lambda opening a fresh IAM-authenticated connection
inside Cognito's 5-second window — is expected to fail intermittently, and intermittently is the
worst way for an auth path to fail.

## Decision

Keep the allowlist in PostgreSQL and the trigger in the VPC, and buy determinism rather than a
second datastore:

1. **One source of truth.** `invitations` in PostgreSQL stays the only allowlist. No projection into
   another service, so there is no dual-write to keep consistent and no compensation logic.
2. **Provisioned concurrency of 1** on the pre-sign-up function, so the execution environment and
   its pgx connection are already warm when Cognito calls. At 128–256 MiB this is roughly
   **$1–3 per month** — **approved by the owner on 2026-10-11** — inside NFR-COST-01's headroom
   (current estimate $35–45 of $50), and it is the
   one place in this architecture where a cold start is a user-visible failure rather than a slow
   response.
3. **A connect timeout below the ceiling** for this function only — 3 seconds, not the API's 12 — so
   a slow connection fails fast and fails **closed** with a stable error code rather than being cut
   off mid-flight by Cognito.
4. **Least privilege:** a third database role, `presignup_ro`, with `SELECT` on `invitations` and
   `users` and nothing else (S1-17); the function has no internet and no write rights.
5. **Measured, not assumed.** S1-18 records cold and warm p99 trigger duration on dev against the
   5-second ceiling before the slice is called done.

If S1-18 shows the budget is still missed, the fallback is the alternative below, and this ADR is
superseded rather than quietly stretched.

## Alternatives considered

| Option | Why not |
|---|---|
| Cold VPC Lambda, no provisioned concurrency | The project's own connect timeout and S0-09's incident say this exceeds 5 s on a cold start. Fails closed, so uninvited users stay out, but invited users are refused at random. |
| Non-VPC trigger reading a DynamoDB allowlist projection | Removes the latency risk entirely and costs ~$0 at this volume, but adds a second store that must stay consistent with `invitations`, which means dual-write plus compensation in every S5 admin workflow. Kept as the documented fallback if S1-18 fails. |
| Pre-create Cognito users at invite time and skip the trigger | Needs the identity Lambda and Cognito admin APIs, which are S5-05. It would pull a whole slice forward, and self sign-up stays disabled either way. |
| Raise the Cognito trigger timeout | Not possible; the 5-second limit is fixed. |
| Allow sign-up and check the invitation at first API call | Violates SEC-02: an uninvited Google account would get a Cognito identity. |

## Consequences

**Positive:** one allowlist, no synchronisation problem, least-privilege database access, and a
latency risk that is bounded and measured rather than discovered during the demo.
**Negative:**
- A small always-on cost, and the first architecture decision in this project that spends money to
  buy latency. Approved by the owner on 2026-10-11 under CLAUDE.md §0.6.
- Provisioned concurrency is not covered by the budget guard aspect, so the cost sits in config and
  the budget alarm rather than in a synth-time check.
- A deactivated user who has **already** signed up never reaches this trigger; that case is the
  API's job (S1-06), and S1-03's acceptance criteria now say so.

**Cost:** about $1–3 per month, dev only until prod lands at M3.

## Validation

- S1-18: measured cold and warm p99 trigger duration on dev, recorded here.
- S1-03: uninvited, expired, already-accepted and deactivated emails are each refused with a stable
  error code; an invited email with a pending unexpired invitation passes.
- S1-17: negative test that `presignup_ro` cannot write.

## Open items

- Decide the exact memory size for the trigger, which sets the provisioned-concurrency cost.
- Revisit when prod is enabled at M3: two environments means two reservations.
