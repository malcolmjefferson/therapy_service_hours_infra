T = []
def t(*a): T.append(a)

# ---------------- S8 Supervisor dashboard ----------------
t("S8-01","Story","Supervisees list endpoint with pending counts",
  "OpenAPI plus GET /supervisees returning accepted supervisees (name, pending count, last entry date) via a supervisor DTO; SQL aggregates.",
  "Only accepted links listed|Pending counts correct|Paginated",
  1.5,"S7-04,S6-05","FR-DASH-01,FR-DASH-03","US-19","backend,api","High")
t("S8-02","Story","Supervisee summary endpoint",
  "GET /supervisees/{id}/summary: per-goal approved vs pending hours, pending and rejected counts, last entry date, reusing the S3 aggregates scoped by the authz relationship check.",
  "Non-supervisee returns 404|Ended link returns 404|Numbers equal the supervisee's own progress view",
  2,"S8-01,S3-02,S1-07","FR-DASH-01,NFR-SEC-02","US-19","backend,api,security","High")
t("S8-03","Story","Supervisee entries endpoint",
  "GET /supervisees/{id}/entries with filters, sort allowlist, pagination (reuses S7-03 query shape); notes visible to supervisors by design.",
  "Sort allowlist enforced|Cross-supervisor access refused|Pagination default 50",
  1.5,"S8-02,S7-03","FR-DASH-02,NFR-SEC-01","US-20","backend,api","High")
t("S8-04","Story","Frontend: supervisee list and selector",
  "Supervisees page sorted by pending count with search; selecting opens the detail view (URL-driven).",
  "Deep link to a supervisee works|Empty state when no supervisees",
  1.5,"S8-01,S1-11","FR-DASH-01,FR-DASH-03","US-19","frontend","High")
t("S8-05","Story","Frontend: supervisee summary cards",
  "Read-only goal cards (reusing ProgressBar) plus counts and last entry date.",
  "Matches API values|aria-valuetext correct",
  1.5,"S8-04,S3-05,S8-02","FR-DASH-01","US-19","frontend","High")
t("S8-06","Story","Frontend: drill-down entries list with review actions",
  "Entries table for the selected supervisee with filters, sorting, pagination and approve/reject/bulk/revert via S7 components.",
  "Actions update summary and list|Reasons required where specified",
  2,"S8-05,S8-03,S7-12","FR-DASH-02,FR-REV-01,FR-REV-02,FR-REV-03","US-20,US-21,US-22,US-23","frontend","High")
t("S8-07","Task","Tests: authz negatives, E2E and axe for the dashboard",
  "Non-supervisee, ended-link and cross-org negatives; Playwright path from supervisee list to approval; axe.",
  "Negatives pass|E2E passes|axe clean",
  2,"S8-06","NFR-SEC-06,FR-DASH-01,FR-DASH-02","US-19,US-20","test,e2e,security","High")

# ---------------- S9 Milestones ----------------
t("S9-01","Task","OpenAPI: celebrations list and acknowledge",
  "GET /goals/celebrations returns uncelebrated crossed milestones per goal; POST /goals/celebrations/ack records the highest acknowledged percent.",
  "Spectral clean|Schema excludes On-site",
  1,"S3-03,S7-04","FR-MS-01,FR-MS-02","US-13","api","Medium")
t("S9-02","Story","Milestone computation service",
  "Compute highest newly crossed milestone (25/50/75/100) from approved hours versus last_celebrated_percent; never lowers the stored value (revert does not reset it).",
  "Table-driven tests incl. multi-crossing, revert then re-approve, target change|On-site never celebrates",
  1.5,"S9-01","FR-MS-01,FR-MS-02","US-13","backend","High")
t("S9-03","Story","Celebration endpoints with atomic acknowledge",
  "Conditional update of last_celebrated_percent (only increases); concurrent acks idempotent.",
  "Two tabs acknowledging concurrently produce one celebration|Value never decreases",
  1.5,"S9-02","FR-MS-02","US-13","backend,api,db","High")
t("S9-04","Story","Frontend: celebration banner and confetti",
  "Solid-color banner cycling gold, lime, red with the specified messages; confetti canvas disabled under prefers-reduced-motion; dismissible; focus managed.",
  "No gradients|Messages match CLAUDE.md §7.3|Reduced motion shows banner only|Contrast >= 4.5:1",
  2,"S2-10,S9-01","FR-MS-03","US-13","frontend,a11y","High")
t("S9-05","Story","Frontend: celebration orchestration on app load",
  "On load fetch celebrations, show them one at a time (highest per goal), acknowledge after display, never replay on reload.",
  "Reload does not replay|Failure to acknowledge does not loop forever|Multiple goals queue in order",
  1.5,"S9-04,S9-03","FR-MS-01,FR-MS-02","US-13","frontend","High")
t("S9-06","Task","Tests: replay protection, revert and re-approve, E2E",
  "Backend integration and Playwright: approve to cross 25%, celebrate once, reload, revert, re-approve.",
  "No replay in any scenario|E2E passes",
  1.5,"S9-05","FR-MS-02,FR-MS-03","US-13","test,e2e","High")

# ---------------- S10 Team schedules ----------------
t("S10-01","Task","OpenAPI: peer and schedule DTOs",
  "Spec GET /schedules/peers?search= and GET /schedules/{userId}?weekStart= with whitelisted schemas (date, start, end, category only), weekend count, 400 on non-Monday.",
  "Schedule schema has no reference to the entry model|Spectral clean",
  1,"S6-02,S2-03","FR-SCH-03,FR-SCH-02,NFR-SEC-03","US-38","api,security","High")
t("S10-02","Story","Peer relationship queries",
  "Static queries: users sharing the same accepted supervisor; supervisor to accepted supervisees; deactivated excluded; search escaped and capped.",
  "Non-peer excluded|Ended-link peers excluded|Wildcards literal",
  1.5,"S10-01,S5-08","FR-SCH-01,NFR-SEC-01","US-36","backend,db,security","High")
t("S10-03","Story","Peers search endpoint",
  "GET /schedules/peers returns only the peer group (no global directory) with names; stricter throttling.",
  "Result limited to peer group|Tighter throttle configured",
  1.5,"S10-02,S1-07","FR-SCH-01","US-36","backend,api","High")
t("S10-04","Story","Week schedule endpoint with whitelisted DTO",
  "GET /schedules/{userId}?weekStart=: authorize peer relationship; return Monday to Friday blocks (date, start, end, category) only; hide rejected and needs-time; count weekend entries.",
  "Response never contains client, notes, hours, on-site or status|weekStart not Monday returns 400|Non-peer returns 404|Weekend count correct",
  2,"S10-02,S10-01,S2-06","FR-SCH-02,FR-SCH-03,FR-SCH-04,NFR-SEC-03","US-37,US-38","backend,api,security","Highest")
t("S10-05","Story","Frontend: peer search and selection with URL state",
  "Team Schedules page with search box, peer list, ?user= and ?week= URL state.",
  "Reload restores selection|No global directory shown",
  1.5,"S10-03,S1-11","FR-SCH-01,FR-SCH-05","US-36","frontend","High")
t("S10-06","Story","Frontend: Monday to Friday week grid and week picker",
  "Time-block grid with category colors, previous/next/this week, 'N entries on weekend not shown' hint.",
  "Defaults to current week|Blocks placed at the right times|Hint text exact",
  2,"S10-05,S10-04","FR-SCH-02,FR-SCH-04,FR-SCH-05","US-37","frontend","High")
t("S10-07","Story","Frontend: responsive day list and keyboard accessibility",
  "Grid collapses to a day list on narrow screens; keyboard navigable; non-color cues for categories.",
  "Usable at 360px width|Tab/arrow navigation works|axe clean",
  1.5,"S10-06","FR-SCH-05,NFR-A11Y-01","US-37","frontend,a11y","High")
t("S10-08","Task","Tests: DTO leak tests, non-peer access, E2E, axe",
  "Go tests asserting banned fields never serialize (reflection and JSON golden), ended link, cross-org; Playwright path for two peers.",
  "Leak test fails if a banned field is added|E2E passes",
  2,"S10-07","NFR-SEC-03,NFR-SEC-06,FR-SCH-03","US-38,US-37","test,e2e,security","High")

# ---------------- S11 Hardening and go-live ----------------
t("S11-01","Task","Authorization negative test suite (six required cases)",
  "Cross-organization requests, cross-organization supervisor lookup, non-peer schedule, supervisor acting on non-supervisee, non-admin on admin routes, admin reading entries without a link; run against real PostgreSQL in CI.",
  "All six pass in CI|Suite fails if a new route lacks an authz test (route inventory check)",
  2,"S8-07,S10-08,S5-16","NFR-SEC-02,NFR-SEC-06","US-44","test,security","Highest")
t("S11-02","Task","Injection suite across every text, search, sort and import input",
  "Generated from the OpenAPI spec: payloads (' OR 1=1 --, '; DROP TABLE, quotes, backslashes, %, _) against all string inputs, plus crafted .md rows.",
  "Suite enumerates inputs from the spec so new inputs are covered automatically|No data or behavior change|Failures print the offending route",
  2,"S4-11,S10-08","NFR-SEC-01","US-43","test,security,adr-0006","Highest")
t("S11-03","Task","Database privilege and IAM policy review tests",
  "Tests proving app_rw cannot run DDL; IAM policies have no wildcards on data actions; cdk-nag or equivalent clean with documented exceptions.",
  "app_rw DDL attempt fails|Policy review recorded|Exceptions listed with reasons",
  1.5,"S5-16","NFR-SEC-01,NFR-SEC-04","US-43","security,infra,adr-0001","High")
t("S11-04","Task","Load sanity and index review",
  "k6 script at 50 users and 20,000 entries; EXPLAIN review of list, aggregate and schedule queries; verify reserved concurrency versus connection limit.",
  "p95 under 500 ms (warm)|No sequential scans on hot paths|Cold start under 2 s measured",
  2,"S10-08,S8-07","NFR-PERF-01,NFR-REL-01","US-45","test,perf","High")
t("S11-05","Task","Assemble and stabilise full E2E suite in the pipeline",
  "All critical-path Playwright tests (sign-in, log, request, accept, approve/reject/revert, schedule, admin invite and role change, import) run in the dev smoke stage with retries policy and artifacts.",
  "Suite green three runs in a row|Runtime under 15 minutes|Flake policy documented",
  2,"S11-01,S9-06","NFR-OPS-02","US-45","e2e,ci","High")
t("S11-06","Task","Accessibility audit and fixes",
  "axe on all key pages plus manual keyboard and screen-reader pass of the schedule grid, progress bars, dialogs; fix findings.",
  "No serious/critical axe violations|Manual checklist signed off",
  2,"S10-08,S9-06","NFR-A11Y-01","US-45","a11y,frontend","High")
t("S11-07","Task","Observability polish and log redaction check",
  "CloudWatch dashboard, alarm tuning, request-id tracing across Lambda and Step Functions, test that logs never contain notes or client names.",
  "Redaction test passes|Dashboard shows errors, latency, throttles, DB connections",
  1.5,"S11-04","NFR-OPS-01,NFR-OPS-04","US-42","ops,security","Medium")
t("S11-08","Task","Cost verification against the $50 budget",
  "Compare actual Cost Explorer or pricing-calculator numbers to the estimate; evaluate optional scheduled stop of the dev database.",
  "Report shows monthly projection under $50|Decision on dev DB stop recorded",
  1,"S11-04","NFR-COST-01","US-41","cost","Medium")
t("S11-09","Task","Backup and restore drill",
  "Restore a prod-like snapshot to a temporary instance, run migrations and smoke tests, delete the instance.",
  "Restore time recorded|Runbook updated with exact steps",
  1.5,"S11-03","NFR-REL-01","US-45","ops","High")
t("S11-10","Task","End-user guide (non-technical) and in-app help link",
  "Plain-language guide for trainees, supervisors and admins covering the screens in this app with fictional screenshots; link from the app header.",
  "Reviewed by a non-technical reader|Uses only pseudonyms|Link present in the app",
  1.5,"S10-08","NFR-DOC-01","US-45","docs","Medium")
t("S11-11","Task","Runbook final: deploy, rollback, restore, rotate, add admin, CA bundle",
  "Complete operational runbook with failure playbooks for pipeline, migration, Cognito, and DB connection exhaustion.",
  "Each playbook tested once in dev|Linked from README",
  1.5,"S11-09,S11-07","NFR-DOC-01,NFR-OPS-02","US-45","docs,ops","High")
t("S11-12","Task","Security review: dependency scan, CSP, secrets scan",
  "Run govulncheck, npm audit, secret scanning, CSP violation review, header scan; triage findings.",
  "No high/critical open findings or documented exceptions|Secrets scan clean across repos",
  1,"S11-02,S11-03","NFR-SEC-05","US-43,US-45","security","High")
t("S11-13","Task","Go-live checklist, doc finalisation and prod approval",
  "Update CLAUDE.md and ADR statuses, confirm open questions closed, verify checklist, owner approves the prod stage.",
  "All ADRs Accepted|CLAUDE.md matches the built system|Prod release approved and smoke-tested",
  1,"S11-05,S11-06,S11-08,S11-10,S11-11,S11-12","NFR-DOC-01","US-45","docs,release","Highest")
