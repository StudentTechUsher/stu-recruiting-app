# Observability Spec: Phase 1 (Stu Recruiting)

## Delivery Boundary
This package delivers docs/specs and ticket-ready implementation scope only.
It does not implement instrumentation, dashboards, or alert wiring in this pass.
Any code/query snippets are normative examples, not required production code.

## Document Metadata
- Spec ID: `OBS-SPEC-001`
- Version: `v1.0`
- Status: `Proposed`
- Last updated: `2026-03-25`
- Owners: `Platform Engineer`, `Backend Engineer`, `Frontend Engineer`

## Context and Assumptions
- Team model: small startup team with shared ownership and limited dedicated SRE capacity.
- Runtime stack: Next.js App Router + Supabase (Auth, Postgres, Storage, Edge Functions).
- Integrations in scope: OpenAI responses/files API, ATS providers (Greenhouse, Lever, BambooHR mock), Resend, source fetches (LinkedIn/GitHub/Kaggle).
- Environment model: `local`, `preview`, `production`.
- Alert transport: Slack + Email.
- Escalation model: business-hours default; 24x7 interruption only for `Sev1`.
- Sentry scope in Phase 1: frontend exceptions, backend exceptions, release tracking, and limited tracing for critical flows.

## Goals
- Detect and triage production failures in auth, extraction/parsing, ATS, storage, and CRM paths quickly.
- Provide stable telemetry contracts that can be implemented without enterprise-scale tooling.
- Produce a ticket-ready instrumentation backlog for Week 1 and Week 2.
- Provide alerting that is formula-driven and low-noise for low to medium traffic volumes.
- Establish candidate SLOs for internal reliability review.

## Non-Goals
- Building a full enterprise observability platform.
- Organization-wide SIEM/SOC workflows.
- Deep business analytics event strategy beyond operational reliability.
- Full distributed tracing across every service/component.
- Fully automated anomaly detection.

## Recommended Architecture Decision
### ADR-OBS-001: Sentry + Structured Logs + Derived Reliability Metrics
Decision:
- Use Sentry as primary system for exception tracking, release health, and sampled traces for critical flows.
- Emit structured JSON logs from backend route handlers and critical library paths.
- Produce derived reliability metrics from counters/histograms and log/DB-derived aggregation for SLO and alert calculations.

Why this decision:
- Minimal operational overhead for small team.
- Faster adoption vs running self-hosted tracing/log pipelines.
- Supports immediate reliability coverage across frontend, backend, async-like flows, and dependencies.

Tradeoffs:
- Pros:
  - Low setup complexity and fast time-to-value.
  - Good error triage UX for startup team.
  - Supports release correlation and core tracing with bounded cost.
- Cons:
  - Partial tracing only in Phase 1.
  - Some metric views derived from logs/queries instead of native high-scale TSDB.
  - Potential vendor lock-in for error workflows.

Alternatives considered:
- Full OTel + self-hosted logs/metrics/traces: too high setup/maintenance for current team.
- Logs-only without Sentry: lower cost but materially slower triage for exceptions and regressions.

## Signal Source of Truth
- Sentry: authoritative for unexpected exception tracking, issue grouping, release health, and sampled critical traces.
- Structured logs: authoritative for request/job lifecycle records, contextual debugging, and domain outcomes.
- Derived metrics: authoritative for alert thresholds, health trends, and SLO measurements.
- Event taxonomy document: authoritative naming contract for events, metrics, spans, and error codes.
- Runbooks document: authoritative operational response for `Sev1` and `Sev2` incidents.

## Telemetry Model
### Required Context Fields
Every telemetry record/event/span/log must include:
- `timestamp`
- `env`
- `service`
- `component`
- `operation`
- `route_template` (never resolved path)
- `outcome` (`success|failure|timeout|retry|dropped`)
- `severity` (`debug|info|warn|error|fatal`)
- `request_id` (backend request scope)
- `trace_id` (if sampled trace exists)

### Common Optional Context Fields
- `persona`
- `provider` (e.g., `openai|greenhouse|lever|resend|supabase_storage`)
- `error_code`
- `http_status`
- `duration_ms`
- `feature_key`
- `session_source`

### Contracts
- `ObsEvent`: immutable, append-only event record for lifecycle transitions.
- `ObsMetric`: aggregated numeric signal derived from events/logs/traces.
- `ObsTraceContext`: correlation fields (`trace_id`, `span_id`, `parent_span_id`, sampled flag).
- `ObsError`: error envelope with expected/unexpected classification.

## Logging Standards
- Format: structured JSON only.
- Log levels:
  - `debug`: local troubleshooting only; disabled/reduced in production.
  - `info`: successful lifecycle transitions.
  - `warn`: expected but notable degradations.
  - `error`: failed operations requiring triage.
  - `fatal`: process-level unrecoverable failures.
- Required fields per entry:
  - `log_id`, `event_name`, `event_version`, required context fields, and redaction-safe payload.
- Correlation:
  - Every backend API request must emit start and end logs with shared `request_id`.
  - Any dependency call log must include `provider` and `dependency_operation`.
- PII handling:
  - Never log raw transcript/resume content.
  - No raw email addresses in metrics.
  - Hash or redact sensitive identifiers when logs leave request-local debugging context.

## Metrics Standards
- Naming: `stu_<domain>_<entity>_<measure>[_unit]`.
- Types:
  - Counter for counts/outcomes.
  - Histogram for duration/size.
  - Gauge for queue depth or active in-flight counts.
- Units:
  - Time in milliseconds (`_ms`).
  - Ratios as unitless decimal [0..1].
- Approved high-value metric tags:
  - `env`, `service`, `route_template`, `provider`, `error_code`, `outcome`.
- Tag governance:
  - Any new metric tag outside approved set must be explicitly justified in [`docs/observability-event-taxonomy.md`](/Users/vinjones/stu-recruiting/apps/stu-recruiting-app/docs/observability-event-taxonomy.md).

## Tracing Standards
- Scope: sampled tracing only for critical flows in Phase 1.
- Transaction naming:
  - `api <method> <route_template>` for route handlers.
  - `web <route_template>` for frontend route-level transactions.
- Required child spans for critical paths:
  - `supabase.query`
  - `supabase.storage.upload|download|remove`
  - `openai.responses.create`
  - `openai.files.upload|delete`
  - `ats.greenhouse.http|ats.lever.http`
  - `resend.emails.send`
- Sampling policy:
  - 100% errors.
  - Low baseline (for cost-conscious tracing) for successful critical transactions.

## Error Tracking Standards
### Expected vs Unexpected Error Policy
- Unexpected errors:
  - Must be sent to Sentry.
  - Can contribute to alerting.
- Expected domain failures:
  - Must emit structured events/logs and metric increments.
  - Sent to Sentry only when investigation-worthy (e.g., abnormal volume or unknown signature).
- User validation errors:
  - Must not page.
  - Must not create noisy Sentry issues by default.
- Provider dependency failures:
  - Alerting depends on formula threshold + blast radius.

### Error Envelope
- `error_code`
- `error_class` (`expected_domain|unexpected_exception|dependency_failure|validation`)
- `is_expected` boolean
- `message` (redaction-safe)
- `fingerprint`
- `route_template`
- `provider` (if applicable)

## Alert Severity Model and Escalation
Reference: [`docs/observability-alert-matrix.md`](/Users/vinjones/stu-recruiting/apps/stu-recruiting-app/docs/observability-alert-matrix.md)

Rules:
- Business-hours response by default.
- 24x7 interruption only for `Sev1`.
- `Sev2` must never page after hours unless explicitly reclassified to `Sev1` by blast-radius rules.

## Dashboard Plan
### Dashboard Catalog
- `DASH-API-001`: API Reliability Overview.
- `DASH-AUTH-001`: Auth and Session Health.
- `DASH-EXTRACT-001`: Artifact Extraction and Parsing.
- `DASH-ATS-001`: ATS Integration Reliability.
- `DASH-AI-001`: AI Quota and Dependency Health.
- `DASH-STORAGE-001`: Upload and Storage Reliability.

### Dashboard Panel Contract
Every panel definition must include:
- `panel_name`
- `query_intent`
- `linked_metrics`
- `linked_slo_id` (nullable; required when panel tracks SLO compliance)

## Candidate SLOs (Internal)
SLOs are candidate internal reliability objectives, not contractual customer SLAs.
Phase 1 SLOs are for operational learning and internal reliability review.

- `SLO-API-AVAIL-001`: Core API request success ratio.
- `SLO-AUTH-LOGIN-001`: Magic link initiation success ratio.
- `SLO-EXTRACT-RESUME-001`: Resume extraction success ratio.
- `SLO-TRANSCRIPT-PARSE-001`: Transcript parse completion success ratio.
- `SLO-ATS-PIPELINE-001`: ATS pipeline fetch success ratio.

Detailed formulas/owners/sources/mappings are defined in [`docs/observability-alert-matrix.md`](/Users/vinjones/stu-recruiting/apps/stu-recruiting-app/docs/observability-alert-matrix.md).

## Privacy Rules
- Prohibit telemetry payloads containing:
  - Raw resume/transcript text.
  - Raw email addresses in metric tags.
  - Candidate identifiers in metric tags.
  - Request IDs in metric tags.
  - Freeform user-entered text in metric tags.
- Use `route_template`, not concrete URL path segments.
- Use hash/redaction for identifiers when needed for correlation.

## Sentry Integration Plan (Phase 1)
- Setup:
  - Frontend and backend SDK initialization.
  - Environment and release tagging.
  - Exception capture in route handlers and critical dependency boundaries.
- Coverage:
  - Auth flows.
  - Student extraction/transcript parsing flows.
  - ATS provider flows.
  - CRM write paths.
- Tracing:
  - Critical route transactions and dependency spans only.
- Alerting:
  - High-severity issue-volume and regression alerts wired to Slack + Email.

## Phase Rollout Plan
### Week 1 (Critical Path)
1. API request correlation IDs + unexpected error capture baseline.
2. Auth login/session instrumentation (`/api/auth/login/*`, callback/session context).
3. Resume extraction instrumentation.
4. Transcript parse/materialize instrumentation.
5. Sentry baseline (frontend/backend), release/env tags.
6. `Sev1`/`Sev2` alert routing rules.
7. Initial API/auth/extraction dashboards.

### Week 2
1. ATS route and dependency instrumentation.
2. CRM note/reminder write-path instrumentation.
3. SLO queries and dashboard/SLO mappings.
4. Alert noise tuning and deduplication review.
5. Runbook drills for at least two `Sev2` scenarios.

## Deferred Beyond Phase 1
- Full distributed tracing across all services.
- Replay-by-default.
- Advanced anomaly detection.
- Long-retention centralized log platform.
- Enterprise SIEM/SOC workflows.
- Deep product analytics instrumentation.
- Full Phase 2 verification audit observability model.

## Package Acceptance Criteria
- All IDs are unique and stable.
- Every `ALRT-*` maps to exactly one `RB-*`.
- Every `Sev1` and `Sev2` alert includes first-10-minute triage steps.
- Every `SLO-*` includes formula, owner, source metrics, and dashboard mapping.
- All examples pass privacy review.
- All Week 1/Week 2 tasks include owner role, priority, and completion evidence.
- Recommended stack is implementable without enterprise observability platform requirements.
