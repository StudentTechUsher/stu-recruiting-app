# `app/api/recruiter` API Surface Spec

## Domain Responsibilities
| Responsibility | Description |
| --- | --- |
| Recruiter API entrypoints | Expose recruiter-facing candidate, evidence, CRM, and related workflow endpoints. |
| Access control enforcement | Require recruiter/org admin authorization for recruiter endpoints. |
| Response contract stability | Return consistent payloads for candidate review and evidence inspection clients. |
| Event capture | Persist recruiter actions (view, note, status change) tied to `candidate_id` and `application_id` for auditable interaction history. |

## High-Level Data Contracts
| Contract | Required fields |
| --- | --- |
| Candidate list response | Candidate/application identity, role context, capability summary/evidence indicators |
| Application context | `application_id`, `candidate_id`, `employer_id`, role/job context, optional `artifact_snapshot_ids` or provenance references |
| Candidate action request | `candidate_key`, `action_name`, optional details |
| CRM response | Candidate records, timeline, notes, reminders |
| Evidence references | Artifact identifiers and provenance references suitable for side-panel inspection |

## Interaction With System Models
| System model | Interaction |
| --- | --- |
| Identity/ownership model | Uses canonical `candidate_id` linkage after claim; no post-claim employer profile fork behavior. |
| Application model | Provides application-level context for candidate review, including role and source provenance linkage. |
| Verification model | Exposes verification state as trust metadata only. |
| Artifact model | Returns evidence links and artifact context for recruiter inspection flows. |

## Invariants
| Invariant ID | Must always be true |
| --- | --- |
| API-001 | Recruiter APIs must not expose cross-employer raw source payloads. Only normalized artifact representations with provenance metadata may be returned. |
| API-002 | Recruiter APIs in Phase 1 must not emit or depend on candidate scoring/ranking/filtering outputs. |
| API-003 | Recruiter evidence responses remain provenance-aware and compatible with canonical merge rules. |
| API-004 | Claimed candidates resolve to a single canonical profile in API linkage and responses. |
| API-005 | API responses must return the canonical (highest-trust) artifact representation by default, while preserving access to provenance-linked versions where applicable. |
