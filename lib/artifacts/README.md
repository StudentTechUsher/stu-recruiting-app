# `lib/artifacts` Domain Spec

## Domain Responsibilities
| Responsibility | Description |
| --- | --- |
| Extraction orchestration | Convert source inputs (transcript, resume, LinkedIn, GitHub, Kaggle) into artifact drafts. |
| Normalization | Enforce required artifact shape and metadata conventions. |
| Provenance retention | Preserve source lineage and non-canonical artifact versions. |
| Canonical merge support | Provide artifact-level merge inputs to canonical profile reconciliation. |
| Verification metadata assignment | Set artifact verification method, source, and state from available paths. |

---

## High-Level Data Contracts
| Contract | Required fields |
| --- | --- |
| Artifact record | `artifact_id`, `profile_id`, `artifact_type`, `artifact_data`, `file_refs`, provenance metadata |
| Artifact verification metadata | `verification_status`, `verification_method`, optional `verification_source` |
| Provenance link | Source descriptor + reference to non-canonical/snapshot evidence version |
| Canonical selection input | `verification_strength`, `completeness_score`, `updated_at` |

> **Clarification:**  
An artifact represents a logical evidence entity. Multiple artifact versions may exist for the same logical artifact, each with independent provenance and verification metadata.

---

## Interaction With System Models
| System model | Interaction |
| --- | --- |
| Identity/ownership model | Pre-claim artifacts may originate in employer-scoped contexts; post-claim all writes merge into the canonical candidate profile. |
| Verification model | Artifact verification state is assigned by method matrix and used for trust display and canonical merge precedence. |
| Evidence Profile model | Artifact records are the underlying data substrate for the candidate’s canonical Evidence Profile. |

---

## Invariants
| Invariant ID | Must always be true |
| --- | --- |
| ART-001 | Artifact writes are provenance-preserving; historical versions are not discarded during reconciliation. |
| ART-002 | Canonical artifact representation is selected by verification strength, then completeness, then recency. |
| ART-003 | Verification metadata is present and internally consistent with artifact source path. |
| ART-004 | Artifact processing does not produce candidate scores, rankings, or filters in Phase 1. |
| ART-005 | Post-claim, all artifact writes must target the canonical candidate profile; no employer-scoped artifact variants may be created. |
| ART-006 | Pre-claim, artifact merging must not occur across employer-scoped variants. |
| ART-007 | Artifact ownership is candidate-owned after claim; source ownership is retained only as provenance metadata. |

---

## Canonical vs Versioned Artifacts
| Concept | Definition |
| --- | --- |
| Canonical artifact | The selected representation used in recruiter-facing evidence, determined by merge rules. |
| Artifact version | A source-specific instance of an artifact with its own provenance and verification state. |
| Provenance linkage | Relationship between canonical artifact and its non-canonical versions. |

---

## Completeness Signal Definition
| Signal | Description |
| --- | --- |
| `completeness_score` | Relative measure of structured data coverage and field population for an artifact version. |
| Source of signal | Derived during normalization from presence of required and optional fields. |
| Use | Only used as secondary tie-breaker after verification strength. |