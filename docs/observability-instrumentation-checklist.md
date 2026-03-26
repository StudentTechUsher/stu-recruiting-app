# Observability Instrumentation Checklist (Phase 1)

## Document Metadata
- Spec ID: `OBS-CHECKLIST-001`
- Version: `v1.0`
- Status: `Proposed`
- Last updated: `2026-03-25`

## Delivery Scope Reminder
This checklist defines implementation-ready tasks only.
It does not imply the tasks are completed in this pass.

## Required Task Schema
Every checklist task must include:
- `task_id`
- `owner_role`
- `priority`
- `component`
- `definition_of_done`
- `evidence_required`

Priority scale:
- `P0`: release-blocking reliability foundation.
- `P1`: high-value reliability coverage.
- `P2`: enhancement and hardening.

## Week 1 Critical-Path Priority Order
1. Correlation IDs + error capture.
2. Auth/session flows.
3. Resume extraction routes.
4. Transcript parse/materialize routes.
5. Sentry baseline + release/environment tags.
6. `Sev1`/`Sev2` alert routing.
7. Initial API/auth/extraction dashboards.

## Week 1 Tasks
| task_id | week | owner_role | priority | component | definition_of_done | evidence_required |
| --- | --- | --- | --- | --- | --- | --- |
| `OBS-P1-001` | 1 | `Backend Engineer` | `P0` | API request middleware | Request-level `request_id` generated/propagated and logged for all `/api/*` handlers | sample logs showing shared `request_id` across start/end/dependency logs |
| `OBS-P1-002` | 1 | `Backend Engineer` | `P0` | Error envelope | Unexpected errors captured with `error_code`, `route_template`, `outcome=failure`, `trace_id` when present | Sentry issue screenshot + structured log snippet |
| `OBS-P1-003` | 1 | `Backend Engineer` | `P0` | Auth routes | Instrument `/api/auth/login/student`, `/recruiter`, `/referrer`, `/staff`, `/logout` lifecycle outcomes | event count output and error breakdown by route |
| `OBS-P1-004` | 1 | `Backend Engineer` | `P0` | Resume extraction | Instrument `/api/student/extract/resume` for attempt/success/failure and dependency sub-operations | metric snapshots + failure sample with `error_code` |
| `OBS-P1-005` | 1 | `Backend Engineer` | `P0` | Transcript parse/materialize | Instrument transcript upload/parse/materialize endpoints and parse session status transitions | dashboard panel screenshot for parse success/failure |
| `OBS-P1-006` | 1 | `Platform Engineer` | `P1` | Sentry baseline | Frontend/backend Sentry enabled with env/release tags and issue grouping rules | captured test exception in `preview` tagged with release/env |
| `OBS-P1-007` | 1 | `Platform Engineer` | `P1` | Alert routing | Configure Slack + Email routes and enforce Sev1 paging-only after-hours policy | alert route config screenshot + test alert receipt |
| `OBS-P1-008` | 1 | `Backend Engineer` | `P1` | Initial dashboards | Create API/Auth/Extraction dashboards with panel contract fields | dashboard export/screenshots with panel metadata |

## Week 2 Tasks
| task_id | week | owner_role | priority | component | definition_of_done | evidence_required |
| --- | --- | --- | --- | --- | --- | --- |
| `OBS-P1-009` | 2 | `Backend Engineer` | `P1` | ATS routes | Instrument ATS endpoints (`greenhouse`, `lever`, recruiter pipeline) with provider-tagged outcomes | metric series and error-ratio query output |
| `OBS-P1-010` | 2 | `Backend Engineer` | `P1` | CRM write paths | Instrument note/reminder create/update paths with success/failure telemetry | log samples + failure ratio panel |
| `OBS-P1-011` | 2 | `Platform Engineer` | `P1` | SLO queries | Implement candidate SLO queries and connect to dashboard panels | query definitions + panel links to `SLO-*` |
| `OBS-P1-012` | 2 | `Platform Engineer` | `P2` | Alert tuning | Validate thresholds, dedup keys, and auto-close rules against real traffic | alert simulation report + tuning notes |
| `OBS-P1-013` | 2 | `Engineering Manager` | `P2` | Runbook drill | Execute two Sev2 drills and record gaps/action items | drill notes + remediation ticket links |
| `OBS-P1-014` | 2 | `Backend Engineer` | `P2` | Quota fallback signal | Add and validate `quota_source` telemetry for RPC vs memory fallback | trend chart showing fallback ratio |

## Cross-Doc Policy Tasks
| task_id | owner_role | priority | component | definition_of_done | evidence_required |
| --- | --- | --- | --- | --- | --- |
| `OBS-P1-015` | `Backend Engineer` | `P1` | Expected/unexpected policy | Error classification policy implemented in instrumentation points and reflected in Sentry routing | sample expected failure not sent to Sentry + unexpected failure sent |
| `OBS-P1-016` | `Platform Engineer` | `P1` | Dashboard-to-SLO contract | Panels include `panel_name`, `query_intent`, `linked_metrics`, and `linked_slo_id` where applicable | dashboard metadata export |
| `OBS-P1-017` | `Platform Engineer` | `P2` | Tag governance | Metric tags audited; any non-approved tags documented and justified in taxonomy | audit checklist and doc links |

## Completion Gate
Checklist is complete when:
- Week 1 `P0` tasks are complete with evidence.
- All alert matrix `Sev1`/`Sev2` signals have instrumented numerator/denominator metrics.
- Dashboard/SLO linkage exists for all `SLO-*` entries.

## Package Acceptance Criteria Traceability
- ID stability and uniqueness: `OBS-P1-*` IDs immutable.
- Owner and priority required on every task.
- Evidence required on every task.
