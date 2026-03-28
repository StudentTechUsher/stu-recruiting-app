# Observability Loom Demo

This document maps the implemented telemetry to a demo flow for the student + recruiter journey.

## Enabled events

### Student flow
- `student.onboarding_complete.start`
- `student.onboarding_complete.result`
- `student.onboarding_completed`
- `student.onboarding_completed.failed`
- `student.profile_save.start`
- `student.profile_save.result`
- `student.profile_saved`
- `student.profile_saved.failed`
- `student.transcript_upload.start`
- `student.transcript_upload.result`
- `student.transcript_upload_started`
- `student.transcript_upload_started.failed`

### Recruiter flow
- `recruiter.candidate_search.start`
- `recruiter.candidate_search.result`
- `recruiter.candidate_search_performed`
- `recruiter.candidate_search_performed.failed`
- `recruiter.candidate_profile_open.start`
- `recruiter.candidate_profile_open.result`
- `recruiter.candidate_profile_opened`
- `recruiter.candidate_profile_opened.failed`

### Unexpected failure lifecycle
- `*.unexpected` lifecycle events include:
  - `sentry_event_id`
  - `request_id`
  - `trace_id` (when present)

## Demo-only failure toggle

Set:

```bash
ENABLE_OBSERVABILITY_DEMO_FAILURE=true
```

Then call:

```text
GET /api/recruiter/candidates?demo_fail=1
```

This throws a controlled non-production exception and emits both:
- structured unexpected-failure logs
- a Sentry exception with route/persona/request tags

## Minimum query filters

Use these log filters in your runtime log destination:

- Activation: `event_name IN ("student.onboarding_completed","student.profile_saved","student.transcript_upload_started")`
- Recruiter engagement: `event_name IN ("recruiter.candidate_search_performed","recruiter.candidate_profile_opened")`
- Reliability: `outcome IN ("handled_failure","unexpected_failure")`

For Sentry, filter issues by tags:
- `route`
- `persona`
- `request_id`
