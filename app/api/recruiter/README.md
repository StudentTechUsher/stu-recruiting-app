# `app/api/recruiter` API Surface Spec

## Domain Responsibilities
| Responsibility | Description |
| --- | --- |
| Recruiter API entrypoints | Expose recruiter-facing candidate, evidence, CRM, and visibility-intake workflow endpoints. |
| Access control enforcement | Require recruiter or org admin authorization for recruiter endpoints. |
| Response contract stability | Return consistent payloads for candidate review and decision-ready package intake clients. |
| Event capture | Persist recruiter actions tied to `candidate_id` and `application_id` for auditable interaction history. |

## High-Level Data Contracts
| Contract | Required fields |
| --- | --- |
| Candidate list response | Candidate and application identity, target context, capability summary, evidence trust indicators |
| Application context | `application_id`, `candidate_id`, `employer_id`, role and target context, optional snapshot or provenance references |
| Candidate action request | `candidate_key`, `action_name`, optional details |
| CRM response | Candidate records, timeline, notes, reminders |
| Evidence references | Artifact identifiers and provenance references for side-panel inspection |
| Visibility intake payload | `open_profile_visibility_request_id`, `candidate_id`, `capability_profile_id`, selected company and role target, profile URL, consent metadata |

## `open_profile_visibility_requests` Contract
| Field | Requirement |
| --- | --- |
| `open_profile_visibility_request_id` | Required unique request identifier |
| `candidate_id` | Required canonical candidate identifier |
| `capability_profile_id` | Required selected target ID |
| `selected_company` | Required selected company label or ID |
| `selected_role` | Required selected role label or ID |
| `candidate_profile_url` | Required Evidence Profile or package URL |
| `permission_confirmation` | Required consent metadata including timestamp and actor |
| `operator_notification_payload` | Required payload for operator-mediated handoff |
| `status` | Required workflow status (`requested`, `queued`, `shared`, `closed`) |

## Interaction With System Models
| System model | Interaction |
| --- | --- |
| Identity and ownership model | Uses canonical `candidate_id` linkage after claim. |
| Capability model | Uses `capability_profile_id` target context for package and evidence interpretation. |
| Verification model | Exposes trust metadata only. |
| Evidence model | Returns evidence links and artifact context for recruiter inspection flows. |
| Visibility workflow model | Consumes controlled request records and operator handoff status. |

## Streaming and Runtime Constraints (Free Tier Assumption)
| Constraint | Requirement |
| --- | --- |
| Runtime budget | Synchronous recruiter AI-assisted interactions must complete comfortably within configured Vercel free-tier function max duration. |
| Streaming | For synchronous AI outputs, prefer streaming responses over buffered full-response delivery. |
| Early emission | First stream event should be emitted quickly to avoid idle request windows. |
| Long workflows | Long-running orchestration must be split into bounded resumable phases. |
| Timeout behavior | APIs must return partial-progress or retryable state rather than blocking until hard timeout. |

## Invariants
| Invariant ID | Must always be true |
| --- | --- |
| API-001 | Recruiter APIs must not expose cross-employer raw source payloads. |
| API-002 | Recruiter APIs must not emit or depend on ranking or scoring outputs. |
| API-003 | Recruiter evidence responses remain provenance-aware and compatible with canonical merge rules. |
| API-004 | Claimed candidates resolve to one canonical profile in linkage and responses. |
| API-005 | API responses return canonical artifact representation by default, with provenance-linked access where applicable. |
| API-006 | Visibility intake remains target-specific and operator-mediated, not mass-broadcast. |

## Cross-References
- `docs/features/recruiter-review-experience.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/system/evidence-model.md`
- `lib/recruiter/README.md`
