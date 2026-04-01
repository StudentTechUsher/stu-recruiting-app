# `lib/recruiter` Domain Spec

## Domain Responsibilities
| Responsibility | Description |
| --- | --- |
| Candidate review assembly | Build recruiter-facing candidate views from ATS and Evidence Profile data. |
| Capability and evidence presentation logic | Provide target-scoped capability summaries and linked evidence references. |
| Decision-ready package intake support | Normalize visibility-authorized package records for recruiter workflows. |
| Timeline and CRM activity | Record recruiter actions, notes, reminders, and timeline context. |
| Candidate identity linking | Use canonical candidate linkage without cross-employer raw-source leakage. |

## High-Level Data Contracts
| Contract | Required fields |
| --- | --- |
| Recruiter candidate row | `candidate_id`, `application_id`, `employer_id`, target context, capability summary, evidence indicators |
| Capability-to-evidence mapping | `capability_profile_id`, `capability_id`, one or more artifact references |
| Visibility request intake | `open_profile_visibility_request_id`, selected target context, package URL, consent metadata |
| Recruiter event or timeline record | `event_id`, `candidate_id`, `application_id`, event type, detail, timestamp |
| CRM note or reminder | `candidate_id`, `application_id`, content or status, actor and timestamps |

## `open_profile_visibility_requests` Contract Expectations
| Field | Requirement |
| --- | --- |
| `open_profile_visibility_request_id` | Required unique ID |
| `candidate_id` | Required canonical candidate ID |
| `capability_profile_id` | Required selected target ID |
| `candidate_profile_url` | Required candidate-facing profile or package URL |
| `permission_confirmation` | Required candidate consent metadata |
| `operator_notification_payload` | Required payload used for operator handoff |

## Interaction With System Models
| System model | Interaction |
| --- | --- |
| Identity and ownership model | Reads canonical candidate profile for claimed candidates. |
| Capability model | Applies selected `capability_profile_id` context in recruiter summaries. |
| Verification model | Surfaces verification state and tier as trust context. |
| Evidence model | Consumes canonical artifacts and provenance-aware references. |
| Visibility workflow model | Consumes controlled target-specific request lifecycle state. |

## Streaming and Runtime Constraints (Free Tier Assumption)
| Constraint | Requirement |
| --- | --- |
| Runtime budget | Synchronous recruiter AI-assist operations complete within configured Vercel free-tier max duration. |
| Streaming delivery | Prefer streaming incremental text or structured events for synchronous AI outputs. |
| Bounded orchestration | Multi-step workflows run as bounded phases with resumable state. |
| Timeout fallback | Return recoverable status and retry hints when time budget risk is detected. |

## Invariants
| Invariant ID | Must always be true |
| --- | --- |
| REC-001 | Recruiter review uses evidence support semantics, not ranking semantics. |
| REC-002 | Capability entries map to concrete evidence or explicit no-evidence state. |
| REC-003 | Recruiters may view canonical evidence post-claim while raw cross-employer data remains isolated. |
| REC-004 | Recruiter domain logic must not create per-employer profile forks for claimed candidates. |
| REC-005 | Evidence displayed to recruiters uses canonical artifact representation by default. |
| REC-006 | Candidate list ordering is deterministic and not candidate-quality ranked. |
| REC-007 | Domain logic must not introduce implicit ranking-like confidence indices. |
| REC-008 | Visibility-authorized intake remains controlled, target-specific, and operator-mediated. |

## Cross-References
- `app/api/recruiter/README.md`
- `docs/features/recruiter-review-experience.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/system/evidence-model.md`
