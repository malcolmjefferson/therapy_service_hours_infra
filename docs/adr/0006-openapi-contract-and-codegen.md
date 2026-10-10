# ADR-0006: OpenAPI as the contract, with pinned copy and drift gate

- **Status:** Accepted · **Date:** 2026-10-09 (accepted 2026-10-10) · **Deciders:** project owner
- **Related:** NFR-DOC-01, NFR-SEC-03, CLAUDE.md §0.5, §3, §10 · Tickets: S0-04, S0-19, S1-05, S11-02

## Context

The frontend and backend live in separate repositories and ship together. The working agreement is **interface first**: change `api/openapi.yaml` before implementing an endpoint or its client. We need to keep the two sides honest without manual copying.

## Decision

- `api/openapi.yaml` (OpenAPI 3.1) in the **backend** repo is the single source of truth.
- **Backend:** `oapi-codegen` generates request/response types and a chi server interface from the spec, so handlers cannot drift from it. Request validation middleware validates against the spec.
- **Frontend:** `openapi-typescript` generates types and `openapi-fetch` provides the typed client. The frontend keeps a **pinned copy** of the spec at `src/lib/api/openapi.yaml` and records the backend commit SHA it came from.
- **Sync:** the pipeline build step copies the backend spec at the commit being released into the frontend workspace and **fails the build if the frontend's pinned copy differs** (drift gate). A helper `npm run api:sync` updates the copy locally.
- **Lint and compatibility:** `spectral` lints the spec (naming, problem+json responses, pagination parameters, `Idempotency-Key`). `oasdiff` flags **breaking changes** against the previous release's spec; a breaking change needs an explicit label on the PR.
- **Mocking:** MSW handlers are typed from the generated types; a test asserts every spec path has a handler or an explicit exemption.
- **DTO discipline:** response schemas are explicit field lists. Peer and supervisor schemas never reference the entry model (supports NFR-SEC-03).
- Errors: RFC 7807 `application/problem+json` with a shared `Problem` schema.

## Alternatives considered

| Option | Why not |
|---|---|
| Hand-written types on both sides | Drift is inevitable. |
| Code-first spec generation (swag) | Spec becomes a by-product; violates interface first. |
| GraphQL / tRPC | Not in the Decided stack; Go backend. |
| Shared git submodule | Awkward with CodeConnections; the pinned copy plus gate is simpler. |

## Consequences

**Positive:** compile-time contract on both sides; breaking changes are visible in review; MSW and E2E share types.
**Negative:** generated code in review diffs; two codegen toolchains; the pinned copy needs a sync commit on each contract change; some OpenAPI 3.1 features are not fully supported by generators (keep to a conservative subset).
**Cost:** $0.

## Validation

- CI: regenerate and `git diff --exit-code` on generated files.
- CI: spectral and oasdiff run; a deliberately breaking change fails the build.
- CI: frontend drift gate fails when the copy differs.
- Contract test: schema-validate real API responses from integration tests against the spec.

## Open items

- Decide whether generated code is committed (proposal: yes, for reviewability and build speed).
