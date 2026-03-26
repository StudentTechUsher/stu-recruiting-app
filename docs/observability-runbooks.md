# Observability Runbooks (Phase 1)

## Document Metadata
- Spec ID: `OBS-RUNBOOK-001`
- Version: `v1.0`
- Status: `Proposed`
- Last updated: `2026-03-25`

## Usage Rules
- Runbooks in this document are authoritative for `Sev1` and `Sev2` incidents.
- Every runbook includes first-10-minute actions.
- Do not page after hours for `Sev2` unless incident is reclassified to `Sev1` per blast-radius policy.

## Incident Communication Templates
### Internal Incident Start Message
```text
[INCIDENT START] <severity> <alert_id> in <env>
Impact: <who/what is affected>
Started: <timestamp UTC>
Current hypothesis: <short hypothesis>
Owner: <name/role>
Next update in: 15 minutes
```

### Periodic Update Message
```text
[INCIDENT UPDATE] <severity> <alert_id>
Status: <investigating|mitigating|monitoring>
Findings: <key findings>
Actions in progress: <current action>
ETA next update: <timestamp>
```

### Incident Resolved Message
```text
[INCIDENT RESOLVED] <severity> <alert_id>
Resolved at: <timestamp UTC>
Root trigger: <one-line root cause>
Mitigation: <what fixed it>
Customer impact window: <start-end>
Post-incident summary: <link or owner/date>
```

### Post-Incident Summary Template
```text
Incident ID: <id>
Severity: <sev>
Timeline: <key timestamps>
Root cause: <technical>
Detection gaps: <what failed>
Action items: <owner, due date>
Preventive controls: <tests, alerts, docs>
```

## First-10-Minute Global Checklist
1. Acknowledge alert and assign incident owner.
2. Confirm severity and paging eligibility.
3. Validate blast radius (persona, route, provider, env).
4. Check recent deploy/release markers.
5. Begin mitigation path if customer impact confirmed.

## Runbook Catalog
| runbook_id | alert_ids | severity |
| --- | --- | --- |
| `RB-API-5XX-001` | `ALRT-API-5XX-RATE-HIGH` | `Sev1` |
| `RB-AUTH-MAGIC-LINK-001` | `ALRT-AUTH-MAGIC-LINK-FAILURE-SPIKE` | `Sev2` |
| `RB-EXTRACT-RESUME-001` | `ALRT-EXTRACT-RESUME-FAILURE-RATE`, `ALRT-EXTRACT-RESUME-ZERO-SUCCESS` | `Sev2/Sev1` |
| `RB-TRANSCRIPT-PARSE-001` | `ALRT-TRANSCRIPT-PARSE-FAILED-RATE` | `Sev2` |
| `RB-TRANSCRIPT-STUCK-001` | `ALRT-TRANSCRIPT-PARSE-STUCK-PROCESSING` | `Sev1` |
| `RB-ATS-GREENHOUSE-001` | `ALRT-ATS-GREENHOUSE-ERROR-SPIKE`, `ALRT-ATS-GREENHOUSE-OUTAGE` | `Sev2/Sev1` |
| `RB-ATS-LEVER-001` | `ALRT-ATS-LEVER-ERROR-SPIKE` | `Sev2` |
| `RB-OPENAI-DEPENDENCY-001` | `ALRT-OPENAI-EXTRACTION-FAILURE-SPIKE` | `Sev2` |
| `RB-STORAGE-UPLOAD-001` | `ALRT-STORAGE-UPLOAD-FAILURE-SPIKE` | `Sev2` |
| `RB-CRM-WRITE-001` | `ALRT-CRM-WRITE-FAILURE` | `Sev2` |
| `RB-AI-QUOTA-FALLBACK-001` | `ALRT-AI-QUOTA-RPC-FALLBACK-SPIKE` | `Sev3` |
| `RB-SENTRY-ERROR-001` | `ALRT-SENTRY-UNEXPECTED-ERROR-VOLUME` | `Sev2` |

## RB-API-5XX-001
- Trigger: `ALRT-API-5XX-RATE-HIGH`
- First 10 minutes:
  1. Confirm 5xx ratio by `route_template` and top `error_code`.
  2. Check Sentry issue spike and latest release.
  3. Verify dependency health: Supabase, OpenAI, ATS provider, Resend.
  4. If single-route concentrated, isolate traffic via safe fallback/feature gate.
- Diagnostics:
  - Query recent backend logs by `route_template`, `request_id`, `error_code`.
  - Inspect DB/storage operation failure rates.
- Mitigation:
  - Roll back latest risky deploy if correlated.
  - Disable problematic feature-path if available.
- Verification:
  - Confirm ratio drops below auto-close threshold for 15m.

## RB-AUTH-MAGIC-LINK-001
- Trigger: `ALRT-AUTH-MAGIC-LINK-FAILURE-SPIKE`
- First 10 minutes:
  1. Check failures across student/recruiter/referrer routes.
  2. Validate Supabase auth availability and redirect URL config.
  3. Verify throttle behavior vs real failures.
- Diagnostics:
  - Analyze error codes: `invalid_magic_link_redirect`, `email_auth_disabled`, provider errors.
- Mitigation:
  - Fix config mismatch (redirect/callback/app URL).
  - Temporarily announce degraded login if external dependency outage.
- Verification:
  - Successful sends recover above baseline ratio.

## RB-EXTRACT-RESUME-001
- Trigger: `ALRT-EXTRACT-RESUME-FAILURE-RATE`, `ALRT-EXTRACT-RESUME-ZERO-SUCCESS`
- First 10 minutes:
  1. Confirm whether failures are upload, OpenAI extraction, or artifact persistence.
  2. Check `document_extraction_failed` and storage upload failures.
  3. Check OpenAI response/file API errors and latency.
- Diagnostics:
  - Compare `attempted`, `failed`, `success` in 15m window.
  - Break down by `error_code` and `provider`.
- Mitigation:
  - If OpenAI issue: enable degraded mode guidance and retry messaging.
  - If storage issue: verify bucket permissions and rollback recent storage-related changes.
- Verification:
  - At least one successful extraction in 10m.
  - Failure ratio returns below threshold.

## RB-TRANSCRIPT-PARSE-001
- Trigger: `ALRT-TRANSCRIPT-PARSE-FAILED-RATE`
- First 10 minutes:
  1. Confirm parser failures by model and route.
  2. Check download failures from storage and OpenAI parse failures.
  3. Validate quota rejection is not miscounted as parser failure.
- Diagnostics:
  - Inspect `parse_error` payload distribution in sessions.
- Mitigation:
  - Restart stuck workloads if safe.
  - Apply safe parser fallback behavior where applicable.
- Verification:
  - Parse success resumes, failed ratio drops below threshold.

## RB-TRANSCRIPT-STUCK-001
- Trigger: `ALRT-TRANSCRIPT-PARSE-STUCK-PROCESSING`
- First 10 minutes:
  1. Query `transcript_parse_sessions` for rows stuck in `processing` > 20m.
  2. Identify shared failure mode (same model, same storage path, same release).
  3. Assess impact scope and reclassify incident if broad.
- Diagnostics:
  - Correlate with OpenAI and storage dependency logs.
- Mitigation:
  - Mark irrecoverable sessions failed with explicit error; unblock retries.
- Verification:
  - Stuck count drops below close condition.

## RB-ATS-GREENHOUSE-001
- Trigger: `ALRT-ATS-GREENHOUSE-ERROR-SPIKE`, `ALRT-ATS-GREENHOUSE-OUTAGE`
- First 10 minutes:
  1. Confirm provider is Greenhouse and errors are not auth-context failures.
  2. Check API key/config changes and provider status.
  3. Identify route concentration (`pipeline`, `jobs`, `candidates`, `applications`).
- Diagnostics:
  - Break down status classes (4xx/5xx).
- Mitigation:
  - Switch to degraded mode messaging for recruiter pages.
  - Roll back recent provider config changes.
- Verification:
  - Success resumes or degraded mode stabilizes user experience.

## RB-ATS-LEVER-001
- Trigger: `ALRT-ATS-LEVER-ERROR-SPIKE`
- First 10 minutes:
  1. Confirm Lever endpoint failures and status mix.
  2. Validate API key and provider enablement.
  3. Compare against recent deployment changes.
- Diagnostics:
  - Route-level and status-level error distribution.
- Mitigation:
  - Restore config and apply temporary retries/backoff if safe.
- Verification:
  - Error ratio below close threshold.

## RB-OPENAI-DEPENDENCY-001
- Trigger: `ALRT-OPENAI-EXTRACTION-FAILURE-SPIKE`
- First 10 minutes:
  1. Confirm failing operations (`files.upload`, `responses.create`).
  2. Check status code clusters and timeout rates.
  3. Validate API key and model configuration.
- Diagnostics:
  - Parse `openai_*_failed:*` signatures.
- Mitigation:
  - Apply temporary degraded behavior and user messaging.
- Verification:
  - OpenAI success ratio recovery and queue/process stabilization.

## RB-STORAGE-UPLOAD-001
- Trigger: `ALRT-STORAGE-UPLOAD-FAILURE-SPIKE`
- First 10 minutes:
  1. Confirm bucket/path scope and policy errors.
  2. Verify Supabase storage health and credentials.
  3. Check file-size/type rejection patterns.
- Diagnostics:
  - Split true provider failures vs expected client validation failures.
- Mitigation:
  - Correct bucket policy/credential errors; rollback offending changes.
- Verification:
  - Upload success recovers above threshold.

## RB-CRM-WRITE-001
- Trigger: `ALRT-CRM-WRITE-FAILURE`
- First 10 minutes:
  1. Identify whether note or reminder writes are failing.
  2. Confirm Supabase service-role client health.
  3. Validate schema migration compatibility.
- Diagnostics:
  - Inspect failing write error codes and affected org scope.
- Mitigation:
  - Apply rollback/fix for schema or permission drift.
- Verification:
  - Write success ratio returns to normal.

## RB-AI-QUOTA-FALLBACK-001
- Trigger: `ALRT-AI-QUOTA-RPC-FALLBACK-SPIKE`
- First 10 minutes:
  1. Confirm fallback source is memory path.
  2. Verify `consume_ai_feature_quota` RPC health.
  3. Estimate user-impact risk from temporary quota inconsistency.
- Diagnostics:
  - Compare RPC success/failure logs.
- Mitigation:
  - Restore DB RPC path; monitor for drift.
- Verification:
  - Memory fallback ratio below threshold.

## RB-SENTRY-ERROR-001
- Trigger: `ALRT-SENTRY-UNEXPECTED-ERROR-VOLUME`
- First 10 minutes:
  1. Identify top issue fingerprints and release correlation.
  2. Confirm unexpected-error policy classification is correct.
  3. Determine if one issue or many regressions.
- Diagnostics:
  - Inspect stack traces, affected routes/personas, deploy timeline.
- Mitigation:
  - Roll back regression or hotfix highest-impact issue first.
- Verification:
  - Unexpected issue volume returns below close condition.

## Runbook Acceptance Criteria
- Each `Sev1`/`Sev2` runbook has first-10-minute triage actions.
- Every `ALRT-*` from alert matrix maps to exactly one runbook entry in this doc.
