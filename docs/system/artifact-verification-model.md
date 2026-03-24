# Artifact Verification Model

## Source of Truth
- Baseline definitions come from `docs/artifact-verification-methods.md`.
- This document classifies methods by delivery status (`live`, `pending`, `planned`) and defines trust-layer behavior.

---

## Verification States and Strength
| Verification state | Meaning | Merge strength |
| --- | --- | --- |
| `verified` | Artifact passed an accepted verification path. | 3 (highest) |
| `pending` | Verification evidence submitted but not yet completed. | 2 |
| `unverified` | No accepted verification completion evidence. | 1 (lowest) |

> **Invariant:** Merge conflict resolution must use verification strength ordering (3 > 2 > 1) when selecting canonical artifact representations.

---

## Verification Method Matrix by Artifact Type
| Artifact type | Verification method | Classification | Resulting state |
| --- | --- | --- | --- |
| `coursework` | `transcript_parse` | live | `verified` |
| `coursework` | `transcript_extraction` | live | `verified` |
| `coursework` | `syllabus_upload` | pending | `pending` until validated |
| `coursework` | `syllabus_ai_match` | pending | `verified` after successful validation |
| `project` | `github_extraction` | live | `verified` |
| `project` | `kaggle_extraction` | live | `verified` |
| `project` | `resume_extraction` | live | `unverified` |
| `project` | `linkedin_extraction` | live | `unverified` |
| `project` | `project_supporting_doc_review` | planned | `verified` after reviewer/AI validation |
| `internship` | `internship_document_review` | planned | `verified` after reviewer/AI validation |
| `internship` | `manager_attestation` | planned | `verified` |
| `employment` | `employment_document_review` | planned | `verified` after reviewer/AI validation |
| `employment` | `hr_or_manager_attestation` | planned | `verified` |
| `certification` | `certificate_document_review` | planned | `verified` after reviewer/AI validation |
| `certification` | `issuer_registry_validation` | planned | `verified` |
| `leadership` | `leadership_role_document_review` | planned | `verified` after reviewer/AI validation |
| `leadership` | `organization_roster_validation` | planned | `verified` |
| `club` | `club_membership_document_review` | planned | `verified` after reviewer/AI validation |
| `club` | `membership_roster_validation` | planned | `verified` |
| `competition` | `competition_result_document_review` | planned | `verified` after reviewer/AI validation |
| `competition` | `organizer_result_validation` | planned | `verified` |
| `research` | `research_output_document_review` | planned | `verified` after reviewer/AI validation |
| `research` | `publication_or_doi_validation` | planned | `verified` |
| `test` | `official_score_report_review` | planned | `verified` after reviewer/AI validation |
| `test` | `assessment_provider_validation` | planned | `verified` |

---

## Verification Assignment Rules (If/Then)
| If | Then |
| --- | --- |
| Source is transcript parse/extraction and payload passes validation | Set `verification_status = verified` with transcript method. |
| Source is GitHub or Kaggle extraction and payload passes extraction checks | Set `verification_status = verified` with source extraction method. |
| Coursework is manual and has syllabus evidence awaiting validation | Set `verification_status = pending`, method `syllabus_upload`. |
| Source is resume or LinkedIn extraction with no additional validation | Set `verification_status = unverified`. |
| Planned verifier path completes successfully | Promote `pending` or `unverified` artifact to `verified`. |

> **Invariant:** Verification is assigned per artifact version (per source instance), not globally across all representations of an artifact.

> **Invariant:** Extraction-based verification (e.g., transcript, GitHub) is considered a trusted source validation, but does not override independent verification methods when both exist.

---

## Trust-Layer Impact (No Ranking)
| Verification state | Recruiter impact | Candidate decisioning impact |
| --- | --- | --- |
| `verified` | Show highest trust indicator on artifact/evidence card. | No ranking/filtering effect |
| `pending` | Show in-review indicator. | No ranking/filtering effect |
| `unverified` | Show low-trust indicator. | No ranking/filtering effect |

> **Invariant:** Verification must not be used for ranking, ordering, or filtering candidates in Phase 1.

---

## Artifact Types With Limited Live Verification Coverage
| Artifact type | Live coverage status | Notes |
| --- | --- | --- |
| `internship` | no live verification path | Only planned document/attestation paths exist |
| `employment` | no live verification path | Only planned document/attestation paths exist |
| `certification` | no live verification path | No issuer validation implemented |
| `leadership` | no live verification path | No institutional validation implemented |
| `club` | no live verification path | No roster validation implemented |
| `competition` | no live verification path | No organizer validation implemented |
| `research` | no live verification path | No publication validation implemented |
| `test` | no live verification path | No provider validation implemented |

---

## Multi-Method Verification Gap Analysis
| Gap ID | Artifact types | Gap description | Required direction |
| --- | --- | --- | --- |
| VER-001 | `internship`, `employment` | No independent live attestation channel beyond planned document review. | Add direct manager/HR attestation and reconciliation logic. |
| VER-002 | `certification`, `test` | No issuer/provider live validation path is implemented. | Add issuer/provider validation integrations. |
| VER-003 | `leadership`, `club`, `competition`, `research` | Evidence relies on planned reviewer path only. | Add independent institutional or organizer validation paths. |
| VER-004 | `project` | Verified extraction exists, but manual project evidence lacks implemented verifier completion. | Ship supporting-document verification path. |

---

## Cross-System Invariants
| Invariant ID | Rule |
| --- | --- |
| VER-INV-001 | Verification strength determines artifact representation precedence, not ownership precedence. |
| VER-INV-002 | Candidate ownership always overrides employer ownership regardless of verification state. |
| VER-INV-003 | All artifact versions must retain verification state and provenance metadata for auditability. |