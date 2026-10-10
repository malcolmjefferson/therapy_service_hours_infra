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

## Deviations and refinements to CLAUDE.md (apply after acceptance)

1. **ADR-0002** adds a thin non-VPC `admin-orchestrator` Lambda in front of Step Functions, because a VPC Lambda cannot reach the Step Functions API without a paid endpoint, and the API Gateway JWT authorizer cannot check group claims.
2. **ADR-0003** has the non-VPC CodeBuild project invoke the migration Lambda, rather than a pipeline Lambda action, because a VPC Lambda cannot call CodePipeline `PutJobResult`.
3. **ADR-0004** uses a CloudFront Function for SPA routing, not distribution-wide custom error responses, which would rewrite `/api/*` errors.
4. **ADR-0006** adds `oapi-codegen` to the backend toolchain.

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
