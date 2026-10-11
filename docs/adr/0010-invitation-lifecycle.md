# ADR-0010: Invitation lifecycle and just-in-time user provisioning

- **Status:** Accepted · **Date:** 2026-10-11 (accepted 2026-10-11) · **Deciders:** project owner
- **Related:** FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-ADM-05, FR-ADM-08, SEC-02, SEC-06 · Tickets: S1-04, S1-03, S1-06, S1-09

## Context

The `invitations` table as specified (CLAUDE.md §9) is `id, email (unique), organization_id, roles,
invited_by, created_at, accepted_at`. Reviewing S1 against it surfaced four things nobody had
decided:

- **No expiry.** An invitation is a permanent allowlist entry: an address invited today can sign in
  a year later. There is no `expires_at` and no requirement that there should be.
- **Nothing writes `accepted_at`.** The pre-sign-up trigger is read-only by design (ADR-0007), and
  the auth middleware was not asked to stamp it. So "has this invitation been used" is unanswerable
  and re-use is unbounded.
- **Re-invite collides.** `email` is unique with no status column, so FR-ADM-05's permanent delete
  followed by a re-invite, and FR-ADM-08's email change, both hit the unique index. Those land in
  S5, but the **schema** is fixed in S1-04, and fixing it later is an expand/contract migration.
- **No `users` row for an invited user.** The pre-sign-up trigger admits an invited email; the auth
  middleware then needs a `users` row to resolve the actor; and the only thing that creates `users`
  rows in S1 is the seed, for the admin. Everything that creates ordinary users is S5-07. So
  S1-13's demo — *"invited user lands in app with name shown"* — could not pass.

## Decision

- `invitations` gains **`expires_at`** (default validity **14 days**, set at creation) and
  **`status`** (`pending`, `accepted`, `revoked`), and the uniqueness constraint becomes a **partial
  unique index on `email` where `status = 'pending'`**. History is kept, re-invites do not collide,
  and revoking is a status change rather than a delete.
- The pre-sign-up trigger admits an email only when it has a **pending, unexpired** invitation and
  the matching user, if any, is not deactivated.
- **First sign-in provisions just in time.** The auth middleware, inside the same transaction that
  binds `cognito_sub`, creates the `users` row from the pending invitation (organization, roles,
  names from the token's `given_name`/`family_name`) and sets the invitation to `accepted` with
  `accepted_at`. This is the one write the identity path makes, it is idempotent through the unique
  indexes on `email` and `cognito_sub`, and it is what makes the S1 demo real without pulling S5
  forward.
- The **seed** (S1-09) creates the first admin's invitation **and** `users` row, so the owner's first
  sign-in binds rather than provisions, and in dev it may create the test invitations ADR-0011 needs.
- When S5 arrives, its admin workflows create the invitation and the `users` row together; JIT
  provisioning stays as the fallback for an invitation that has no row yet, and the invariant
  "a pending invitation may be redeemed exactly once" holds in both paths.

## Alternatives considered

| Option | Why not |
|---|---|
| No expiry, as today | A permanent allowlist entry for an address nobody has thought about in a year; the cheapest thing to get wrong. |
| Expiry enforced only in the UI | SEC-02's check runs in the trigger; a UI rule would not be enforced where it matters. |
| Delete the invitation on acceptance | Loses the audit trail and makes "was this address ever invited" unanswerable. |
| Keep `email` unique and delete rows to re-invite | Same loss, plus a race between delete and insert during an email change. |
| Pre-create every `users` row at invite time and never provision | That is S5's behaviour, and the right end state, but in S1 nothing can create invitations except the seed, so S1 would have no demo. |
| 30-day or 7-day validity | 14 days is the middle; the number is config, not architecture, and the runbook records it. |

## Consequences

**Positive:** invitations have a lifecycle that supports re-invites, revocation and the email-change
flow S5 needs; the S1 demo works end to end; the acceptance stamp has exactly one writer.
**Negative:**
- The identity read path now also writes, so S1-06 needs the `app_rw` role rather than a read-only
  one, and the trigger stays read-only. Two roles with different rights on the same tables; S1-17
  keeps them apart.
- An expired invitation is a support case ("I was invited but cannot get in"); the runbook needs the
  re-invite step, and until S5 that means invoking the seed Lambda.

**Cost:** $0.

## Validation

- S1-04: migration applies through the migrate Lambda; the partial index rejects a second pending
  invitation for the same email and allows a pending one after an accepted one.
- S1-03: expired and already-accepted invitations are refused.
- S1-06: first sign-in of an invited user creates the row and stamps acceptance; concurrent first
  requests produce one row.

## Open items

- S5-11 (email change) must set the old invitation to `revoked` and create a new pending one; noted
  on that ticket when it is written.
