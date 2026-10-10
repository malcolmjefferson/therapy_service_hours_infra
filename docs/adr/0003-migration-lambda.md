# ADR-0003: Database migrations via a VPC migration Lambda

- **Status:** Accepted · **Date:** 2026-10-09 (accepted 2026-10-10) · **Deciders:** project owner
- **Related:** NFR-OPS-02, CLAUDE.md §13 · Tickets: S0-10, S0-15, S0-16

## Context

The database is in private subnets. CodeBuild runs outside the VPC (a VPC CodeBuild would need NAT or endpoints to reach GitHub, S3 and ECR). Migrations therefore need an execution point **inside** the VPC that the pipeline can trigger.

## Decision

- A dedicated **`migrate` Lambda** (Go, in the VPC) runs **goose** with migrations **embedded** in the binary (`go:embed db/migrations`), connecting as the `migrator` role through IAM auth (ADR-0001).
- A **non-VPC CodeBuild** step runs `aws lambda invoke --function-name … --cli-read-timeout …` synchronously and fails the stage on a non-success payload. (A VPC Lambda cannot call CodePipeline `PutJobResult`, so a native Lambda invoke action is not viable.)
- Goose takes a **PostgreSQL advisory lock** so concurrent releases cannot run migrations twice.
- **Stack order per environment:** data stack (network, RDS, roles) → **migrate** → app stack (API, web). Migrations run *before* new code goes live.
- Migrations are **forward-only, additive-first (expand / contract)**. A destructive change needs two releases. A CI check rejects `DROP`/`ALTER ... DROP` in a migration unless the file is explicitly tagged `-- +contract`.
- Before the **prod** migration the pipeline takes an RDS **snapshot**. Failure of the prod migration stops the release; recovery is a new forward migration or snapshot restore (documented in the runbook).
- The Lambda timeout is 15 minutes; long migrations must be split.

## Alternatives considered

| Option | Why not |
|---|---|
| Run migrations at API Lambda startup | Races across concurrent cold starts; API role would need DDL (violates least privilege). |
| CodeBuild in the VPC | Needs NAT or several endpoints; violates budget guard. |
| Bastion / SSM tunnel | Standing infrastructure and manual steps; not repeatable. |
| RDS Data API | Only for Aurora Serverless. |
| Down-migrations | Rarely safe with data; forward-only with expand/contract is simpler. |

## Consequences

**Positive:** repeatable, auditable, no standing access path to the DB; API role stays DML-only.
**Negative:** a custom invoke step; embedding makes the migrate binary change with every migration; rollback means roll forward.
**Cost:** $0 added (Lambda invocations, one snapshot per prod release within backup storage).

## Validation

- Pipeline test in dev: deliberately broken migration fails the stage and prevents the app stack deploy.
- Integration test: running the migrate handler twice is a no-op.
- Integration test: two concurrent invocations; one waits on the advisory lock.
- CI: contract-tag check fails on an untagged `DROP COLUMN`.

## Open items

- Snapshot retention for pre-migration snapshots (proposal: delete after 7 days).
