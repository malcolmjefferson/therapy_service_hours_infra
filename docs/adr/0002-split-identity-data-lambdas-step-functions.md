# ADR-0002: Split identity and data Lambdas coordinated by Step Functions

- **Status:** Accepted · **Date:** 2026-10-09 (accepted 2026-10-10) · **Deciders:** project owner
- **Related:** FR-ADM-02 to FR-ADM-08, FR-AUTH-01 · Tickets: S5-04 to S5-11

## Context

Admin actions touch **two systems**: Cognito (create or disable a user, set groups, sign out) and PostgreSQL (user row, invitation, audit log, link changes). With no NAT and no interface endpoints:

- A Lambda **in the VPC** can reach RDS but **cannot** reach Cognito admin APIs or the Step Functions API.
- A Lambda **outside the VPC** can reach AWS APIs but **cannot** reach the private RDS instance.

Also, the API Gateway **JWT authorizer validates the token but cannot require a group claim** on a route, so admin routes need a server-side check before anything privileged starts.

## Decision

Use three small functions and a state machine:

1. **`admin-orchestrator`** (Go, **outside VPC**). Reached by the API Gateway admin routes. It checks the `cognito:groups` claim contains `admin`, validates input, and starts a **Step Functions Express** workflow (synchronous) with the actor and request. It never touches the database.
2. **`identity`** (Go, **outside VPC**). Calls Cognito admin APIs. Each operation is idempotent.
3. **`api`** (Go, **inside VPC**), invoked by the state machine as the "data step". It re-verifies the actor is an active admin in the database, performs the DB writes in one transaction, and writes `admin_audit_log`.

Workflow shape (create user): data step "validate and reserve" → identity step "create / link Cognito user and groups" → data step "commit". On identity failure a **compensation** step reverts the reservation. Delete and email-change follow the same pattern.

Non-admin routes (entries, supervision, schedules) go straight from API Gateway to the VPC `api` Lambda.

The state machine invokes the VPC Lambda through the Lambda service API, so no VPC endpoint is needed.

## Alternatives considered

| Option | Why not |
|---|---|
| One Lambda in the VPC + NAT | About $33/month per NAT; violates budget guard. |
| One Lambda in the VPC + Cognito/Step Functions interface endpoints | About $7+/month per endpoint per AZ; violates budget guard. |
| One Lambda outside the VPC + public DB | Violates NFR-SEC-04. |
| Cognito Lambda triggers to sync DB | Triggers run outside our transaction; fragile, hard to audit. |
| Direct Lambda-to-Lambda calls without Step Functions | Works, but compensation, retries, and visibility need hand-written code. |

## Consequences

**Positive:** stays within budget; the DB is the source of truth; explicit compensation and an execution history for audit; each function has a minimal IAM role.
**Negative:**
- More moving parts (3 functions + 1 state machine) for a feature used rarely.
- Eventual-consistency window between Cognito groups and DB role mirror; the API re-verifies roles against the DB on each privileged request (FR-AUTH-04).
- Express workflows have a 5-minute limit and at-least-once semantics: every step must be idempotent.
- Token claims are stale until refresh; role revocation is enforced by the DB check, not the token.

**Cost:** Express Workflows and Lambda at this volume fall within free or cents-level cost.

## Validation

- Integration tests per workflow with the identity step stubbed to fail at each position; assert DB and audit state after compensation.
- Test: non-admin token calling an admin route gets 403 from `admin-orchestrator` and no execution starts.
- Test: demoted admin with a still-valid token is refused by the data step.
- Test: duplicate invocation produces no duplicate user, invitation, or audit rows.

## Open items

- OQ-01 (Google-only vs also email/password) affects the Cognito linking logic; resolved by spike S1-02 before S5.
