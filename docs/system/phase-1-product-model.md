# Phase 1 Product Model (No Scoring or Ranking)

## System Boundary
| Dimension | Phase 1 Rule |
| --- | --- |
| ATS position | Stu operates behind ATS platforms through integrations. |
| Decision role | Stu does not score, rank, or automatically filter candidates. |
| Core function | Stu extracts, normalizes, maps, and verifies evidence for recruiter review. |
| Output intent | Evidence-backed review support only. |

> **Invariant:** Phase 1 is a data quality and trust layer, not a decision-making system.

---

## Canonical Profile Model

> **Invariant:** After claim, each candidate has exactly one canonical Evidence Profile.

> **Rule:** All post-claim ingestion, merging, and updates must target this canonical profile. Employer-scoped profile variants must not exist after claim.

> **Ownership transition:**  
- Pre-claim: employer-scoped profile variants  
- Post-claim: candidate-owned canonical Evidence Profile  

---

## Inputs
| Input class | Sources | Example payload scope | Ownership at ingest |
| --- | --- | --- | --- |
| ATS candidate/application data | Greenhouse, Lever, BambooHR (and equivalent) | Candidate identity fields, job/application metadata, pipeline stage, attachments | Employer-scoped before claim |
| Transcript evidence | Transcript PDF + parsed transcript outputs | Courses, course metadata, transcript-derived coursework artifacts | Candidate evidence layer |
| External profile links | GitHub, LinkedIn, Kaggle | Public profile metadata, repository/project evidence, competition/research context | Candidate evidence layer with provenance |
| Candidate-entered supporting files | Syllabus and artifact support files | Manual evidence attachments and verification-support files | Candidate evidence layer |

---

## Processing Stages
| Stage | Description | Required output |
| --- | --- | --- |
| Ingestion | Capture ATS and external evidence inputs. | Raw source records with source IDs and timestamps |
| Extraction | Parse or transform source data into artifact candidates. | Structured artifact drafts |
| Normalization | Enforce artifact type, required fields, provenance, and dedupe strategy. | Normalized artifact records |
| Capability mapping | Map artifacts to one or more capabilities. | Capability-to-evidence links |
| Verification assignment | Assign trust status from available verification methods. | `verification_status` + method/source metadata |
| Evidence Profile update | Merge records into canonical candidate Evidence Profile using deterministic merge rules. | Updated canonical profile + provenance history |

> **Invariant:** Evidence Profile updates must never create additional profile variants after claim.

> **Invariant:** Artifacts are never deleted; all versions must remain preserved as provenance-linked records.

---

## Output Contracts
| Output | Description | Consumer |
| --- | --- | --- |
| Artifacts | Typed evidence records with provenance and verification metadata. | Recruiter review, candidate profile UX |
| Capabilities | Capability labels supported by linked artifacts. | Recruiter list/detail views |
| Evidence links | Relationship between capability and specific artifacts. | Evidence side-panel inspection flow |

---

## State Transition (Text Diagram)
`ATS_IMPORTED -> IDENTITY_MATCHED -> EVIDENCE_EXTRACTED -> EVIDENCE_NORMALIZED -> CAPABILITY_MAPPED -> VERIFICATION_ASSIGNED -> EVIDENCE_PROFILE_UPDATED`

---

## Deterministic Behavior Requirements
| Requirement | Rule |
| --- | --- |
| Ordering | Candidate list ordering must be deterministic (e.g., ATS stage, application time), not derived from inferred candidate quality. |
| Merge behavior | Artifact selection must follow verification → completeness → recency ordering. |
| Identity resolution | All ingestion must converge to a single canonical profile post-claim. |

---

## Explicit Exclusions
| Exclusion | Rule |
| --- | --- |
| Candidate scoring | No numeric candidate score is generated in Phase 1. |
| Candidate ranking | No ordered ranking list is generated in Phase 1. |
| Automated filtering | No auto-accept, auto-reject, or auto-hold decisions are made by Stu in Phase 1. |
| Verification-based gating | Verification states influence trust display only, not candidate inclusion or exclusion. |
| Implicit scoring | No proxy metrics (confidence, strength, completeness scores) may be introduced that function as ranking. |

---

## Cross-References
| Referenced section | Document |
| --- | --- |
| Section 3: Identity and ownership model | `docs/system/identity-ownership-model.md` |
| Section 4: Recruiter experience | `docs/features/recruiter-review-experience.md` |
| Section 5: Verification model | `docs/system/artifact-verification-model.md` |