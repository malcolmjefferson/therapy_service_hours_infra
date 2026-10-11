# Architecture Decision Records

Format: lightweight [MADR](https://adr.github.io/madr/). Status values: **Proposed** → **Accepted** (owner approves) → **Superseded**. Nothing marked Recommended in `CLAUDE.md` is built until its ADR is **Accepted**.

| ADR | Title | Status | Needed before | Touches CLAUDE.md |
|---|---|---|---|---|
| [0001](0001-rds-iam-authentication.md) | RDS IAM authentication for database access | Accepted | S0 | §2, §4.1 |
| [0002](0002-split-identity-data-lambdas-step-functions.md) | Split identity and data Lambdas coordinated by Step Functions | Accepted | S5 | §2, §4 diagram (adds admin-orchestrator) |
| [0003](0003-migration-lambda.md) | Database migrations via a VPC migration Lambda | Accepted | S0 | §2, §13 (CodeBuild invokes Lambda; stack order) |
| [0004](0004-cloudfront-same-origin-api-routing.md) | CloudFront same-origin `/api/*` routing | Accepted | S0 | §2 (adds SPA rewrite Function) |
| [0005](0005-single-infra-owned-pipeline.md) | One infra-owned pipeline for three repositories | Accepted | S0 | §2, §13 |
| [0006](0006-openapi-contract-and-codegen.md) | OpenAPI as the contract, with pinned copy and drift gate | Accepted | S0 | §3, §10 (adds oapi-codegen) |
| [0007](0007-presignup-allowlist-latency.md) | Pre-sign-up allowlist inside the VPC, with a measured latency budget | Accepted | S1 | §4.1 (provisioned concurrency), §9 |
| [0008](0008-api-token-and-claims.md) | ID token as the API credential, claims only from the authorizer | Proposed | S1 | §10, §11.2 |
| [0009](0009-cognito-pool-placement.md) | The user pool lives in the data stack; callback URLs come from config | Proposed | S1 | §4 diagram, §4.2 |
| [0010](0010-invitation-lifecycle.md) | Invitation lifecycle and just-in-time user provisioning | Proposed | S1 | §9 (invitations columns) |
| [0011](0011-automated-sign-in-testing.md) | Automated sign-in tests use a dev-only password app client | Proposed | S1 | §14 (testing strategy) |

## Deviations and refinements to CLAUDE.md (apply after acceptance)

1. **ADR-0002** adds a thin non-VPC `admin-orchestrator` Lambda in front of Step Functions, because a VPC Lambda cannot reach the Step Functions API without a paid endpoint, and the API Gateway JWT authorizer cannot check group claims.
2. **ADR-0003** has the non-VPC CodeBuild project invoke the migration Lambda, rather than a pipeline Lambda action, because a VPC Lambda cannot call CodePipeline `PutJobResult`.
3. **ADR-0004** uses a CloudFront Function for SPA routing, not distribution-wide custom error responses, which would rewrite `/api/*` errors.
4. **ADR-0006** adds `oapi-codegen` to the backend toolchain.
5. **ADR-0007** gives the pre-sign-up trigger provisioned concurrency, because Cognito's synchronous
   trigger timeout is a fixed 5 seconds and this project's own IAM connect timeout is 12 seconds.
6. **ADR-0008** makes the ID token the API credential and the `users` row the only source of role
   authority in S1; `/healthz` gets its own unauthenticated route because authorizers are per route.
7. **ADR-0009** puts the Cognito user pool in the data stack and reads callback URLs from
   configuration, because a CloudFront reference would make the Web and App stacks circular.
8. **ADR-0010** adds `expires_at` and `status` to `invitations` and provisions the `users` row on
   first sign-in.
9. **ADR-0011** allows a password-based app client in dev only, for automated sign-in tests.

## Template

```markdown
# ADR-NNNN: Title
- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD · Deciders: owner · Related: FR/NFR ids, tickets

## Context
## Decision
## Alternatives considered
## Consequences (positive / negative / costs)
## Validation (how we know it works)
## Open items
```
