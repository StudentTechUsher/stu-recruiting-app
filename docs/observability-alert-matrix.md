# Observability Alert Matrix (Phase 1)

## Document Metadata
- Spec ID: `OBS-ALERT-001`
- Version: `v1.0`
- Status: `Proposed`
- Last updated: `2026-03-25`

## Severity and Escalation Policy
- `Sev1`: Critical user-impacting outage or hard dependency failure with immediate business impact.
- `Sev2`: High-impact degradation with partial functionality loss.
- `Sev3`: Moderate degradation requiring same-day action.
- `Sev4`: Low-impact signal for backlog triage.

Escalation rules:
- Business-hours response by default.
- 24x7 interruption only for `Sev1`.
- `Sev2` must never page after hours unless reclassified to `Sev1` by blast-radius rules.

Routing defaults:
- Slack channel: `#stu-incidents`.
- Email fallback: engineering incident list.

## Ratio Alert Rule (Mandatory)
Any rate/percentage alert must define all of:
- Numerator
- Denominator
- Window
- Minimum denominator volume

## Alert Matrix
| alert_id | domain | severity | aggregation_window | sustain_period | threshold_formula | minimum_sample_volume | deduplication_key | auto_close_condition | paging_eligibility | data_source_type | runbook_id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ALRT-API-5XX-RATE-HIGH` | API | `Sev1` | 5m rolling | 10m | `server_error_count / request_count > 0.10` | `request_count >= 100` | `env+service+route_template` | `ratio <= 0.03 for 15m` | `24x7` | `metric` | `RB-API-5XX-001` |
| `ALRT-AUTH-MAGIC-LINK-FAILURE-SPIKE` | Auth | `Sev2` | 15m rolling | 10m | `magic_link_failed / magic_link_attempted > 0.08` | `magic_link_attempted >= 50` | `env+persona+route_template+error_code` | `ratio <= 0.03 for 30m` | `business_hours_only` | `metric` | `RB-AUTH-MAGIC-LINK-001` |
| `ALRT-EXTRACT-RESUME-FAILURE-RATE` | Extraction | `Sev2` default, `Sev1` override | 15m rolling | 10m | `resume_extract_failed / resume_extract_attempted > 0.10` | `resume_extract_attempted >= 25` | `env+route_template+outcome` | `ratio <= 0.04 for 30m` | `business_hours_only` unless Sev1 override | `metric` | `RB-EXTRACT-RESUME-001` |
| `ALRT-EXTRACT-RESUME-ZERO-SUCCESS` | Extraction | `Sev1` | 15m rolling | 15m | `resume_extract_success == 0 AND resume_extract_attempted >= 20` | `resume_extract_attempted >= 20` | `env+route_template` | `resume_extract_success >= 1 in 10m` | `24x7` | `metric` | `RB-EXTRACT-RESUME-001` |
| `ALRT-TRANSCRIPT-PARSE-FAILED-RATE` | Transcript | `Sev2` | 15m rolling | 10m | `parse_failed / parse_attempted > 0.12` | `parse_attempted >= 20` | `env+route_template+parser_model` | `ratio <= 0.05 for 30m` | `business_hours_only` | `metric` | `RB-TRANSCRIPT-PARSE-001` |
| `ALRT-TRANSCRIPT-PARSE-STUCK-PROCESSING` | Transcript | `Sev1` | 10m rolling | 15m | `count(status='processing' AND age_minutes>20) >= 5` | `session_count >= 5` | `env+parser_model` | `count < 2 for 10m` | `24x7` | `db-derived` | `RB-TRANSCRIPT-STUCK-001` |
| `ALRT-ATS-GREENHOUSE-ERROR-SPIKE` | ATS | `Sev2` default, `Sev1` override | 15m rolling | 10m | `greenhouse_failed / greenhouse_attempted > 0.15` | `greenhouse_attempted >= 30` | `env+provider+route_template+error_code` | `ratio <= 0.05 for 30m` | `business_hours_only` unless Sev1 override | `metric` | `RB-ATS-GREENHOUSE-001` |
| `ALRT-ATS-GREENHOUSE-OUTAGE` | ATS | `Sev1` | 15m rolling | 15m | `greenhouse_success == 0 AND greenhouse_attempted >= 20` | `greenhouse_attempted >= 20` | `env+provider` | `greenhouse_success >= 1 in 10m` | `24x7` | `metric` | `RB-ATS-GREENHOUSE-001` |
| `ALRT-ATS-LEVER-ERROR-SPIKE` | ATS | `Sev2` default, `Sev1` override | 15m rolling | 10m | `lever_failed / lever_attempted > 0.15` | `lever_attempted >= 20` | `env+provider+route_template+error_code` | `ratio <= 0.05 for 30m` | `business_hours_only` unless Sev1 override | `metric` | `RB-ATS-LEVER-001` |
| `ALRT-OPENAI-EXTRACTION-FAILURE-SPIKE` | AI Dependency | `Sev2` | 15m rolling | 10m | `openai_failed / openai_attempted > 0.10` | `openai_attempted >= 30` | `env+provider+operation+error_code` | `ratio <= 0.03 for 30m` | `business_hours_only` | `metric` | `RB-OPENAI-DEPENDENCY-001` |
| `ALRT-STORAGE-UPLOAD-FAILURE-SPIKE` | Storage | `Sev2` | 15m rolling | 10m | `storage_upload_failed / storage_upload_attempted > 0.08` | `storage_upload_attempted >= 30` | `env+bucket+route_template` | `ratio <= 0.03 for 30m` | `business_hours_only` | `metric` | `RB-STORAGE-UPLOAD-001` |
| `ALRT-CRM-WRITE-FAILURE` | Recruiter CRM | `Sev2` | 15m rolling | 10m | `crm_write_failed / crm_write_attempted > 0.10` | `crm_write_attempted >= 20` | `env+route_template+error_code` | `ratio <= 0.03 for 30m` | `business_hours_only` | `metric` | `RB-CRM-WRITE-001` |
| `ALRT-AI-QUOTA-RPC-FALLBACK-SPIKE` | AI Quota | `Sev3` | 30m rolling | 20m | `quota_source_memory / quota_decisions_total > 0.20` | `quota_decisions_total >= 50` | `env+feature_key` | `ratio <= 0.05 for 60m` | `none` | `log-derived` | `RB-AI-QUOTA-FALLBACK-001` |
| `ALRT-SENTRY-UNEXPECTED-ERROR-VOLUME` | Error Tracking | `Sev2` | 15m rolling | 10m | `unexpected_error_events >= 40` | `n/a` | `env+service+issue_fingerprint` | `unexpected_error_events < 10 for 30m` | `business_hours_only` | `sentry` | `RB-SENTRY-ERROR-001` |

## Blast Radius Reclassification Rules
- Any `Sev2` dependency-rate alert escalates to `Sev1` if all successful responses for that dependency drop to zero for 15 minutes with minimum sample met.
- Any auth `Sev2` alert escalates to `Sev1` if login flow success ratio is below 50% for 15 minutes and affects both student and recruiter personas.

## SLO Definitions and Mapping
| slo_id | description | formula | owner | source_metrics | dashboard_mapping |
| --- | --- | --- | --- | --- | --- |
| `SLO-API-AVAIL-001` | Core API availability | `1 - (server_error_count / request_count)` over 30d | `Backend Engineer` | `stu_api_requests_total`, `stu_api_server_errors_total` | `DASH-API-001: API Success Ratio` |
| `SLO-AUTH-LOGIN-001` | Magic link initiation reliability | `magic_link_sent / magic_link_attempted` over 30d | `Backend Engineer` | `stu_auth_magic_link_attempt_total`, `stu_auth_magic_link_sent_total` | `DASH-AUTH-001: Magic Link Success` |
| `SLO-EXTRACT-RESUME-001` | Resume extraction reliability | `resume_extract_success / resume_extract_attempted` over 30d | `Backend Engineer` | `stu_extract_resume_attempt_total`, `stu_extract_resume_success_total` | `DASH-EXTRACT-001: Resume Extraction Success` |
| `SLO-TRANSCRIPT-PARSE-001` | Transcript parse completion reliability | `transcript_parse_success / transcript_parse_attempted` over 30d | `Backend Engineer` | `stu_transcript_parse_attempt_total`, `stu_transcript_parse_success_total` | `DASH-EXTRACT-001: Transcript Parse Success` |
| `SLO-ATS-PIPELINE-001` | ATS pipeline fetch reliability | `ats_pipeline_success / ats_pipeline_attempted` over 30d | `Backend Engineer` | `stu_ats_pipeline_attempt_total`, `stu_ats_pipeline_success_total` | `DASH-ATS-001: ATS Pipeline Success` |

## MTTA / MTTR Targets
| severity | target_mtta | target_mttr |
| --- | --- | --- |
| `Sev1` | 10m | 60m |
| `Sev2` | 30m (business hours) | 4h |
| `Sev3` | same business day | 2 business days |
| `Sev4` | next planning cycle | backlog-managed |

## Matrix Acceptance Checks
- Every `ALRT-*` has exactly one `RB-*`.
- Every ratio alert defines numerator, denominator, window, and minimum denominator volume.
- No alert uses non-formula wording as trigger condition.
