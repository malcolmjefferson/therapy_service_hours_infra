# therapy_service_hours_infra

AWS CDK (TypeScript) app: the stacks, the single release pipeline for all three repos, and environment config. Part of the **Therapy Service Hours Tracker** (see [CLAUDE.md](CLAUDE.md)).

## Start here

- **Specification and working agreements:** [CLAUDE.md](CLAUDE.md)
- **Engineering standards** (rules block merges): [docs/standards/](docs/standards/README.md)
- **Decisions:** [docs/adr/](docs/adr/README.md)
- **Backlog:** [docs/jira/](docs/jira/README.md)

## First-time setup

1. Install [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning, SEC-61).
2. Turn on the repo's git hooks once per clone:

   ```bash
   git config core.hooksPath .githooks
   ```

   The pre-commit hook scans staged changes for secrets and **blocks the commit** if gitleaks is missing.

## Commands

Requires Node 22 or later.

| Command | What it does |
|---|---|
| `npm ci` | Install exact dependencies from `package-lock.json` |
| `npm run typecheck` | `tsc` type check (no output files) |
| `npm test` | Vitest unit and assertion tests |
| `npm run synth` | `cdk synth` for every stack in **dev** and **prod**; fails on any guard error |

**AWS account guard (ARC-32):** the account ID is **not committed**. Set `EXPECTED_AWS_ACCOUNT` (locally, and as a pipeline variable) to the project account:

- Credentials active and matching: synth proceeds.
- Credentials for another account, or credentials active with `EXPECTED_AWS_ACCOUNT` unset: synth **refuses**.
- No credentials: synth only, for `EXPECTED_AWS_ACCOUNT` if set, otherwise AWS's documented placeholder `123456789012`. Nothing can be deployed this way.

**Budget guard (ARC-29):** synth fails if an environment declares a NAT Gateway, RDS Proxy, interface VPC endpoint, load balancer, Multi-AZ or second database, RDS/Aurora cluster, or customer-managed KMS key (`lib/guards/budget-guard.ts`). The error names the rule and the construct path. Adding one of these needs the owner's approval and an ADR (CLAUDE.md §0.6).

## Layout

```
bin/app.ts        CDK app entry: one stage per environment
config/           Typed per-environment settings (the only place dev and prod differ, ARC-28)
lib/app-stage.ts  One environment: data, app and web stacks plus mandatory tags
lib/app/          Stacks and constructs by concern (network.ts, database.ts)
lib/guards/       Synth-time guards (budget)
test/             Vitest tests (CDK assertions)
```

## Contributing

- `main` is protected: changes go through a pull request with passing checks (ARC-49).
- Work on a branch named after the ticket, for example `feat/S0-03-backend-skeleton`.
- Fill in the PR template, including the standards checklists.
- Client data is **pseudonyms or initials only**, everywhere (CLAUDE.md §0.7).
