# `lib/recruiter` Domain Spec

## Domain Responsibilities
| Responsibility | Description |
| --- | --- |
| Candidate review assembly | Build recruiter-facing candidate views from ATS + evidence data. |
| Capability/evidence presentation logic | Provide capability summaries and linked evidence references. |
| Timeline and CRM activity | Record recruiter actions, notes, reminders, and timeline context. |
| Candidate identity linking | Use candidate/profile linkage for recruiter context without cross-employer raw-source leakage. |

---

## High-Level Data Contracts
| Contract | Required fields |
| --- | --- |
| Recruiter candidate row | `candidate_id`, `application_id`, `employer_id`, role context, capability summary, evidence indicators |
| Capability-to-evidence mapping | Capability identifier with one-or-more artifact references |
| Recruiter event/timeline record | `event_id`, `candidate_id`, `application_id`, event type, detail, created timestamp |
| CRM note/reminder | `candidate_id`, `application_id`, content/status, actor/timestamps |

> **Clarification:**  
`candidate_id` refers to the canonical candidate identifier post-claim. Any legacy `candidate_key` usage must resolve to `candidate_id` before use in recruiter flows.

---

## Interaction With System Models
| System model | Interaction |
| --- | --- |
| Identity/ownership model | Reads canonical candidate profile for claimed candidates; preserves employer ownership boundaries for raw source payloads. |
| Application model | Uses application context (`application_id`, `employer_id`) to scope recruiter view and actions. |
| Verification model | Surfaces verification state as trust context in recruiter evidence review. |
| Artifact model | Consumes canonical artifacts and provenance-aware evidence references for capability inspection. |

---

## Invariants
| Invariant ID | Must always be true |
| --- | --- |
| REC-001 | Recruiter review flows use evidence support semantics, not ranking or filtering semantics, in Phase 1. |
| REC-002 | Capability entries shown to recruiters must map to concrete artifact evidence or an explicit "no evidence" state. |
| REC-003 | Recruiters may view canonical profile evidence post-claim, but cross-employer raw source data remains isolated. |
| REC-004 | Recruiter domain logic must not create or depend on per-employer profile forks for claimed candidates. |
| REC-005 | Evidence displayed to recruiters must use canonical artifact representations (highest-trust version by merge rules). |
| REC-006 | Candidate list ordering must be deterministic (e.g., ATS stage, application time) and not derived from candidate quality. |
| REC-007 | Recruiter domain must not introduce implicit scoring signals (confidence, strength, completeness) that function as ranking. |