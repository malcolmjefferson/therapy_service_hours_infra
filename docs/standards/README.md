# Engineering Standards

Standards for building the Therapy Service Hours Tracker. They turn the decisions in `CLAUDE.md` and ADR-0001 to ADR-0006 into rules that reviewers and Claude Code can check.

| # | Document | Rule IDs | Covers |
|---|---|---|---|
| 01 | [Go coding standards](01-go-coding-standards.md) | `GO-NN` | Layout, **SOLID in Go**, errors, context, sqlc/pgx, HTTP, authz, logging, testing, lint |
| 02 | [React coding standards](02-react-coding-standards.md) | `FE-NN` | Layout, **SOLID in React**, TypeScript, state, forms, theme, accessibility, performance, testing |
| 03 | [Architecture standards](03-architecture-standards.md) | `ARC-NN` | Principles, reference architecture, layering, API, data, CDK, reliability, observability, when an ADR is needed |
| 04 | [Security standards](04-security-standards.md) | `SEC-NN` | Threat model, authentication, authorization, injection, browser security, privacy, logging, secrets, cloud, supply chain |

## How to use them

- **MUST** rules block a merge. **SHOULD** rules need a one-line reason in the PR to skip. **MAY** is optional.
- Cite rule IDs in review comments, for example "SEC-24: sort field must be allowlisted".
- Every PR runs the checklists at the end of the relevant documents. They extend the Definition of Done in `CLAUDE.md` §0.4.
- Items marked **Default** are sensible starting values (limits, budgets, token lifetimes) that the owner can change. Edit the rule, and note it in the PR.
- To depart from a **MUST**, write an ADR first (see architecture standards §12).

## SOLID at a glance

| Principle | Go (backend) | React (frontend) |
|---|---|---|
| **S**ingle responsibility | Handler, service and store each have one job (GO-10) | Data hooks, logic hooks and presentational components are separate (FE-10) |
| **O**pen/closed | Registries and allowlist maps instead of repeated switches (GO-13, GO-14) | Composition and variant maps instead of boolean props (FE-13, FE-14) |
| **L**iskov substitution | Fakes and adapters honor the same contract, tested by shared contract tests (GO-16, GO-17) | Wrappers extend native props and keep semantics (FE-16, FE-17) |
| **I**nterface segregation | Small interfaces declared by the consumer (GO-20, GO-21) | Narrow props and focused hooks (FE-19, FE-20) |
| **D**ependency inversion | Constructor injection; clock and IDs injected; wiring only in `main` (GO-23, GO-24) | Services provided by context; MSW at the network boundary (FE-22 to FE-24) |
