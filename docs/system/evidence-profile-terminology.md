# Evidence Profile Terminology

## Term Mapping
| Context | Preferred term | Internal term | Definition | API/Schema naming |
| --- | --- | --- | --- | --- |
| Student-facing product language | Evidence Profile | N/A | Candidate-owned evidence layer that represents capabilities and supporting proof. | N/A |
| Internal data model | N/A | artifact | Atomic evidence record with typed payload, provenance, and verification metadata. | artifact_* fields remain valid |
| Internal data collection | N/A | artifact set | Collection of artifacts linked to one candidate profile. | artifacts table |
| Recruiter review UX | Evidence | artifact data + provenance | Recruiter-visible supporting proof attached to capabilities. | API returns artifact records |

---

## Evidence Profile Definition
| Attribute | Rule |
| --- | --- |
| Ownership | Candidate-owned after claim; candidate is canonical owner of identity and profile representation. |
| Record role | System of record for candidate artifacts and normalized evidence. |
| Verification role | Surface for artifact trust state (verified, pending, unverified). |
| Cross-employer boundary | Employer-specific raw source payloads are isolated and never exposed across employers. |
| Phase 1 decision policy | Evidence informs review only; no score, rank, or automatic filter is produced. |

> **Invariant:** After claim, a candidate has exactly one canonical Evidence Profile.

> **Definition:** Canonical Evidence Profile = the unique, candidate-owned profile containing all merged artifacts and their provenance after claim.

---

## Boundary: Evidence Profile vs Artifact
| Item | Evidence Profile | Artifact |
| --- | --- | --- |
| Granularity | Candidate-level container | Single evidence record |
| Ownership semantics | Candidate identity and canonical representation | Source-specific evidence instance with provenance |
| Merge behavior | Consolidates all evidence into one canonical view post-claim | Multiple versions may exist and remain provenance-linked |
| Recruiter display | Capability summaries and linked proof | Concrete evidence card/panel content |

> **Clarification:** Evidence is the recruiter-facing representation of artifacts. Artifacts remain the underlying system records, including multiple provenance-linked versions.

---

## Artifact Representation Rules
| Rule ID | Rule |
| --- | --- |
| TERM-001 | Each artifact may have multiple source-derived versions, each with independent provenance and verification state. |
| TERM-002 | The canonical artifact representation is the highest-trust version selected by merge rules (verification → completeness → recency). |
| TERM-003 | Non-canonical artifact versions must remain accessible as provenance-linked records. |

---

## Naming Rules (If/Then)
| If | Then |
| --- | --- |
| Content is user-facing (UI copy, product docs, recruiter/student flows) | Use **Evidence Profile** and **evidence** terminology. |
| Content is implementation-facing (schema, API payloads, migration docs) | Use existing artifact terminology unless a migration explicitly renames fields. |
| A document references both UX and implementation concerns | State that "Evidence Profile" is external terminology and artifact is internal data-object terminology. |

---

## Explicit Non-Goals
| Topic | Rule |
| --- | --- |
| Terminology migration | This spec does not require immediate schema/API renaming from artifact to evidence. |
| Candidate ranking | Evidence Profile terminology does not introduce scoring, ranking, or filtering semantics. |
| Data model duplication | Evidence is not a separate stored entity; it is derived from artifact records. |