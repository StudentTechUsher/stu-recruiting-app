# Evidence Model Contract

## Purpose
Define the shared artifact/evidence structure used by student and recruiter Phase 1 experiences.

## Terminology
| Context | Term | Definition |
| --- | --- | --- |
| User-facing | Evidence Profile | Candidate-facing representation of capabilities and linked evidence. |
| Internal | Artifact | Typed evidence record with provenance and verification metadata. |
| Internal | Artifact version | A source-specific version of an artifact preserved for auditability. |

## Artifact Record Contract
| Field | Requirement |
| --- | --- |
| `artifact_id` | Required unique identifier. |
| `profile_id` | Required owner profile reference. |
| `artifact_type` | Required typed value (`coursework`, `project`, `internship`, `employment`, `certification`, `leadership`, `club`, `competition`, `research`, `test`). |
| `artifact_data` | Required normalized payload (`title`, `source`, `description`, plus typed fields). |
| `file_refs` | Optional provenance/file references. |
| `created_at` | Required timestamp. |
| `updated_at` | Required timestamp. |

## Evidence Linkage Contract
| Field | Requirement |
| --- | --- |
| `capability_id` | Required capability reference. |
| `artifact_ids` | Required supporting artifact ID list. |
| `verification_breakdown` | Required counts by `verified`/`pending`/`unverified`. |
| `last_evidence_at` | Required most recent supporting evidence timestamp. |

## Version Retention and UI Presentation Rules
| Rule ID | Rule |
| --- | --- |
| EV-001 | Keep all artifact versions as provenance-linked records. |
| EV-002 | Never delete historical versions as part of merge or derivation. |
| EV-003 | Define a primary display artifact for UI only. |
| EV-004 | Primary display priority uses verification, then completeness, then recency. |
| EV-005 | UI display priority must not imply data replacement or data loss. |

## Deterministic Merge/Display Decision Table
| Condition | Primary display behavior | Persistence behavior |
| --- | --- | --- |
| Higher verification strength exists | Display highest verification version | Keep all versions |
| Verification tie, completeness differs | Display most complete version | Keep all versions |
| Verification + completeness tie | Display most recent version | Keep all versions |
| Any conflict on identity ownership | Candidate identity remains authoritative | Keep all versions |

## Phase 1 Exclusions
| Exclusion | Rule |
| --- | --- |
| Ranking | Evidence linkage must not produce candidate ranking signals. |
| Scoring | Evidence linkage must not produce opaque composite scores. |
| Hidden transforms | Recruiter-visible evidence relationships must match student-visible evidence relationships. |
