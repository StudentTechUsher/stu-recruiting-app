# Observability Event Taxonomy (Phase 1)

## Document Metadata
- Spec ID: `OBS-TAXONOMY-001`
- Version: `v1.0`
- Status: `Proposed`
- Last updated: `2026-03-25`

## Naming Authority
This document is the naming authority for:
- Event names (`EVT-*`)
- Metric names (`MET-*`)
- Span names (`SPAN-*`)
- Error codes (`ERR-*`)

## Naming Conventions
### Event Names
Format: `stu.<domain>.<entity>.<action>.<outcome>`

Examples:
- `stu.auth.magic_link.send.success`
- `stu.auth.magic_link.send.failure`
- `stu.extract.resume.run.success`
- `stu.extract.resume.run.failure`
- `stu.transcript.parse.run.timeout`
- `stu.ats.greenhouse.pipeline.fetch.failure`

### Metric Names
Format: `stu_<domain>_<entity>_<measure>[_unit]`

Examples:
- `stu_api_requests_total`
- `stu_api_server_errors_total`
- `stu_auth_magic_link_attempt_total`
- `stu_extract_resume_attempt_total`
- `stu_transcript_parse_duration_ms`

### Span Names
Format: `<domain>.<operation>`

Examples:
- `api.request`
- `supabase.query`
- `supabase.storage.upload`
- `openai.responses.create`
- `ats.greenhouse.http`

### Error Code Style
- lowercase snake_case for domain errors: `document_extraction_failed`, `transcript_upload_failed`
- dependency signatures preserved when needed: `openai_extraction_failed:429:*`

## Core Telemetry Fields
Required on all operational records:
- `event_name`
- `event_version`
- `env`
- `service`
- `component`
- `operation`
- `route_template`
- `outcome` (`success|failure|timeout|retry|dropped`)
- `timestamp`

Recommended when available:
- `request_id`
- `trace_id`
- `persona`
- `provider`
- `error_code`
- `duration_ms`

## Cardinality Guardrails
### Approved High-Value Tags
- `env`
- `service`
- `route_template`
- `provider`
- `error_code`
- `outcome`

### Restricted Tags
- `org_id` is allowed in logs/traces; not allowed in metrics unless explicitly approved.

### Prohibited Metric Tags
- Raw email addresses.
- Candidate identifiers.
- File IDs/paths.
- Full URLs.
- Request IDs.
- Freeform messages.

### Route Rules
- Always tag by `route_template`.
- Never tag by resolved path (e.g., no dynamic IDs in metric dimensions).

### Tag Governance Rule
Any new metric tag outside approved high-value tag set must be explicitly justified and approved in this document before implementation.

## Privacy and Data Handling Rules
- Never emit raw transcript/resume body text in events, logs, spans, or metrics.
- Do not place user-provided freeform content in metric dimensions.
- Hash or redact sensitive identifiers where correlation is required.
- Ensure examples in docs use synthetic/non-production data.

## Event Catalog
| event_id | event_name | trigger point | required fields | source of truth |
| --- | --- | --- | --- | --- |
| `EVT-AUTH-001` | `stu.auth.magic_link.send.success` | magic-link send returns success | `route_template`, `persona`, `outcome` | structured logs |
| `EVT-AUTH-002` | `stu.auth.magic_link.send.failure` | magic-link send fails | `route_template`, `persona`, `error_code`, `outcome` | structured logs + Sentry (unexpected) |
| `EVT-EXTRACT-001` | `stu.extract.resume.run.success` | resume extraction success | `route_template`, `outcome`, `provider` | structured logs |
| `EVT-EXTRACT-002` | `stu.extract.resume.run.failure` | resume extraction failure | `route_template`, `error_code`, `provider`, `outcome` | structured logs + Sentry (unexpected) |
| `EVT-TRANSCRIPT-001` | `stu.transcript.parse.run.success` | transcript parse completes | `route_template`, `parser_model`, `outcome` | structured logs |
| `EVT-TRANSCRIPT-002` | `stu.transcript.parse.run.failure` | transcript parse fails | `route_template`, `parser_model`, `error_code`, `outcome` | structured logs + Sentry (unexpected) |
| `EVT-ATS-001` | `stu.ats.greenhouse.pipeline.fetch.failure` | ATS pipeline fetch failure | `route_template`, `provider`, `error_code`, `outcome` | structured logs |
| `EVT-ATS-002` | `stu.ats.lever.pipeline.fetch.failure` | ATS pipeline fetch failure | `route_template`, `provider`, `error_code`, `outcome` | structured logs |
| `EVT-STORAGE-001` | `stu.storage.upload.failure` | Supabase storage upload fails | `route_template`, `provider`, `error_code`, `outcome` | structured logs |
| `EVT-AI-001` | `stu.ai.quota.decision` | quota decision returned | `feature_key`, `outcome`, `quota_source` | structured logs |

## Metric Catalog
| metric_id | metric_name | type | numerator | denominator | recommended tags |
| --- | --- | --- | --- | --- | --- |
| `MET-API-001` | `stu_api_requests_total` | counter | n/a | n/a | `env`, `service`, `route_template`, `outcome` |
| `MET-API-002` | `stu_api_server_errors_total` | counter | n/a | n/a | `env`, `service`, `route_template`, `error_code` |
| `MET-AUTH-001` | `stu_auth_magic_link_attempt_total` | counter | n/a | n/a | `env`, `route_template`, `persona` |
| `MET-AUTH-002` | `stu_auth_magic_link_sent_total` | counter | n/a | n/a | `env`, `route_template`, `persona` |
| `MET-EXT-001` | `stu_extract_resume_attempt_total` | counter | n/a | n/a | `env`, `route_template` |
| `MET-EXT-002` | `stu_extract_resume_success_total` | counter | n/a | n/a | `env`, `route_template` |
| `MET-TRN-001` | `stu_transcript_parse_attempt_total` | counter | n/a | n/a | `env`, `route_template`, `provider` |
| `MET-TRN-002` | `stu_transcript_parse_success_total` | counter | n/a | n/a | `env`, `route_template`, `provider` |
| `MET-ATS-001` | `stu_ats_pipeline_attempt_total` | counter | n/a | n/a | `env`, `provider`, `route_template` |
| `MET-ATS-002` | `stu_ats_pipeline_success_total` | counter | n/a | n/a | `env`, `provider`, `route_template` |

## Span Catalog
| span_id | span_name | when to emit |
| --- | --- | --- |
| `SPAN-API-001` | `api.request` | API route start/end transaction |
| `SPAN-SUPABASE-001` | `supabase.query` | Supabase DB query calls |
| `SPAN-SUPABASE-002` | `supabase.storage.upload` | file upload calls |
| `SPAN-SUPABASE-003` | `supabase.storage.download` | file download calls |
| `SPAN-OPENAI-001` | `openai.responses.create` | OpenAI response calls |
| `SPAN-OPENAI-002` | `openai.files.upload` | OpenAI file upload calls |
| `SPAN-ATS-001` | `ats.greenhouse.http` | Greenhouse HTTP dependency |
| `SPAN-ATS-002` | `ats.lever.http` | Lever HTTP dependency |

## Error Code Taxonomy (Operational)
| error_id | canonical error_code | class | alertable |
| --- | --- | --- | --- |
| `ERR-AUTH-001` | `magic_link_send_failed` | `expected_domain` | no |
| `ERR-AUTH-002` | `invalid_magic_link_redirect` | `expected_domain` | no |
| `ERR-EXT-001` | `document_extraction_failed` | `expected_domain` | by threshold |
| `ERR-EXT-002` | `source_private_or_inaccessible` | `dependency_failure` | by threshold |
| `ERR-TRN-001` | `transcript_parse_failed` | `expected_domain` | by threshold |
| `ERR-TRN-002` | `transcript_download_failed` | `dependency_failure` | yes (threshold-based) |
| `ERR-ATS-001` | `greenhouse_api_error:*` | `dependency_failure` | yes (threshold-based) |
| `ERR-ATS-002` | `lever_api_error:*` | `dependency_failure` | yes (threshold-based) |
| `ERR-AI-001` | `openai_extraction_failed:*` | `dependency_failure` | yes (threshold-based) |
| `ERR-VAL-001` | `invalid_payload` | `validation` | no |

## Acceptance Checks
- All names follow conventions.
- No prohibited fields are used as metric tags.
- Tag additions outside approved set include explicit written justification.
