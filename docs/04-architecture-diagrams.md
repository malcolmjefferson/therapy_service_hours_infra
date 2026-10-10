# 04. Architecture Diagrams (Mermaid)

Diagrams render on GitHub and in most Markdown viewers. They reflect `CLAUDE.md` **plus** the refinements in ADR-0001 to ADR-0006 (marked *ADR*).

## 1. System component diagram

```mermaid
flowchart LR
  user([Browser user])
  subgraph edge[Edge]
    cf[CloudFront<br/>headers policy + SPA rewrite fn]
    s3[(S3 private bucket<br/>React SPA)]
  end
  subgraph auth[Identity]
    cog[Cognito user pool<br/>Google IdP, invite-only]
    goog([Google])
  end
  apigw[API Gateway HTTP API<br/>JWT authorizer, throttling]
  subgraph novpc[Outside VPC]
    orch[admin-orchestrator Lambda<br/>checks admin group]
    idl[identity Lambda<br/>Cognito admin APIs]
    sfn[[Step Functions Express<br/>admin workflows]]
  end
  subgraph vpc[VPC private subnets, no NAT]
    api[api Lambda<br/>chi, authz, services]
    mig[migrate Lambda<br/>goose embedded]
    pre[PreSignUp Lambda<br/>invitation allowlist]
    rds[(RDS PostgreSQL<br/>single AZ, IAM auth)]
  end
  user --> cf
  cf -->|default| s3
  cf -->|/api/*| apigw
  user -. sign-in redirect .-> cog
  cog <--> goog
  cog -->|trigger| pre
  pre --> rds
  apigw -->|user routes| api
  apigw -->|admin routes| orch
  orch --> sfn
  sfn --> idl
  sfn --> api
  idl --> cog
  api --> rds
  mig --> rds
```

> **PreSignUp note:** the trigger must read the `invitations` table in the private DB, so it runs **in the VPC** (Cognito invokes Lambdas through the Lambda service, no internet needed) and connects with IAM auth (ADR-0001) as a read-only role. Ticket S1-03 builds and tests this.

## 2. Pipeline and environments *(ADR-0003, ADR-0005)*

```mermaid
flowchart TB
  gh1[GitHub frontend] --> src
  gh2[GitHub backend] --> src
  gh3[GitHub infra] --> src
  src[CodePipeline source<br/>CodeConnections, queued mode] --> build
  subgraph build[Build and test, parallel]
    b1[backend: golangci-lint, gosec, govulncheck,<br/>sqlc check, oasdiff, spectral, go test]
    b2[frontend: eslint, tsc, drift gate, vitest]
    b3[infra: cdk synth + budget guard]
  end
  build --> dd
  subgraph dd[Deploy DEV]
    d1[data stack] --> d2[migrate: CodeBuild invokes Lambda] --> d3[app stack] --> d4[frontend sync + invalidate]
  end
  dd --> smoke[Smoke: healthz + authenticated call]
  smoke --> appr{{Manual approval<br/>shows 3 SHAs}}
  appr --> dp
  subgraph dp[Deploy PROD, same artifacts]
    p0[RDS snapshot] --> p1[data stack] --> p2[migrate] --> p3[app stack] --> p4[frontend sync]
  end
  build -. failure .-> sns[SNS to owner email]
  smoke -. failure .-> sns
  appr -. request .-> sns
```

## 3. Backend internals

```mermaid
flowchart TB
  req[API Gateway event] --> mw[Middleware<br/>request id, slog, body limit, recover]
  mw --> val[OpenAPI request validation]
  val --> h[HTTP handlers<br/>generated server interface]
  h --> authz[internal/authz<br/>central policy]
  h --> svc[internal/service<br/>entries, goals, clients, supervision,<br/>review, schedules, notifications, admin]
  svc --> authz
  svc --> q[internal/db<br/>sqlc queries, tx helpers]
  q --> pool[pgx pool + IAM token refresh]
  pool --> pg[(PostgreSQL)]
  svc --> dto[DTO mappers<br/>explicit field lists]
  dto --> h
  h --> err[RFC 7807 error mapping]
```

## 4. Frontend internals

```mermaid
flowchart TB
  main[main.tsx] --> prov[Providers: Router, QueryClient, Auth, Toasts, Theme]
  prov --> shell[App shell: header, nav, banners, badges]
  shell --> feat
  subgraph feat[src/features]
    e[entries]
    g[goals + celebrations]
    c[clients]
    io[import / export]
    s[supervision + requests]
    r[review + supervisor dashboard]
    sch[schedules]
    n[notifications]
    a[admin]
  end
  feat --> comp[src/components<br/>Button, Select, Table, ProgressBar, Toast, Dialog]
  feat --> api[src/lib/api<br/>openapi-fetch client + generated types]
  api --> tq[TanStack Query cache + polling]
  api -->|/api/v1| be[(Backend via CloudFront)]
  shell --> theme[src/theme tokens]
```

## 5. Admin action sequence: create user *(ADR-0002)*

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Sam (Admin)
  participant SPA
  participant GW as API Gateway
  participant O as admin-orchestrator
  participant SF as Step Functions
  participant D as api Lambda (VPC)
  participant I as identity Lambda
  participant C as Cognito
  Admin->>SPA: Submit new user form
  SPA->>GW: POST /admin/users (JWT)
  GW->>O: invoke (claims)
  O->>O: require cognito:groups has admin
  O->>SF: StartSyncExecution
  SF->>D: Step 1 validate + reserve (re-verify actor in DB)
  D-->>SF: user_id, invitation staged
  SF->>I: Step 2 create/link Cognito user + groups
  I->>C: AdminCreateUser / AdminAddUserToGroup
  alt success
    SF->>D: Step 3 commit + audit log
    D-->>SF: ok
    SF-->>O: success
    O-->>SPA: 201 user
  else Cognito failure
    SF->>D: Compensate: remove reservation
    SF-->>O: failed
    O-->>SPA: 502 problem+json
  end
```

## 6. Entry lifecycle *(FR-REV-*)*

```mermaid
stateDiagram-v2
  [*] --> Pending: create / import
  Pending --> Approved: supervisor approve (locks)
  Pending --> Rejected: supervisor reject (reason required)
  Rejected --> Pending: owner edits and saves
  Approved --> Pending: supervisor revert (reason required)
  Pending --> [*]: owner deletes
  Rejected --> [*]: owner deletes
```

## 7. Supervision link lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending: supervisee requests
  pending --> accepted: supervisor accepts (re-check org + state)
  pending --> declined: supervisor declines
  pending --> cancelled: supervisee cancels / org change
  accepted --> ended: supervisee, supervisor or admin ends / org change
  declined --> [*]
  cancelled --> [*]
  ended --> [*]
```

## 8. Entity relationship diagram

```mermaid
erDiagram
  organizations ||--o{ users : has
  organizations ||--o{ invitations : for
  users ||--o{ goals : sets
  users ||--o{ clients : saves
  users ||--o{ entries : logs
  categories ||--o{ entries : classifies
  entries ||--o{ entry_clients : tags
  clients ||--o{ entry_clients : used_in
  entries ||--o{ entry_status_history : tracks
  users ||--o{ supervision_links : supervisee
  users ||--o{ supervision_links : supervisor
  organizations ||--o{ supervision_links : scopes
  users ||--o{ notifications : receives
  users ||--o{ admin_audit_log : acts
  users {
    uuid id PK
    uuid organization_id FK
    citext email UK
    text status
    uuid cognito_sub UK
    bool is_supervisor
    bool is_admin
  }
  entries {
    uuid id PK
    uuid user_id FK
    date session_date
    time start_time
    time end_time
    int duration_minutes
    text status
    bool needs_time
  }
  supervision_links {
    uuid id PK
    uuid supervisee_id FK
    uuid supervisor_id FK
    uuid organization_id FK
    text status
  }
```

## 9. Vertical slice dependency graph

```mermaid
flowchart LR
  S0[S0 Walking skeleton<br/>pipeline, infra] --> S1[S1 Secure sign-in]
  S1 --> S2[S2 Log hours]
  S2 --> S3[S3 Goals + progress]
  S2 --> S4[S4 Import / export]
  S1 --> S5[S5 Admin console]
  S5 --> S6[S6 Supervision + notifications]
  S3 --> S7[S7 Review workflow]
  S6 --> S7
  S7 --> S8[S8 Supervisor dashboard]
  S7 --> S9[S9 Milestones]
  S3 --> S9
  S6 --> S10[S10 Team schedules]
  S2 --> S10
  S8 --> S11[S11 Hardening + go-live]
  S9 --> S11
  S10 --> S11
  S4 --> S11
```
