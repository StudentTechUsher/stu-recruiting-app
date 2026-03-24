# Recruiter Review Experience (Phase 1)

## 4.1 Candidate List View
| Requirement | Rule |
| --- | --- |
| Job role filtering | Recruiter can filter candidate list by job role. |
| Candidate source | Candidates come from ATS-linked application data. |
| Summary content | Each row includes capability summary and high-level evidence indicators. |
| Ranking behavior | No score, rank position, or auto-filter state is shown in Phase 1. |
| List ordering | Default ordering must be deterministic (e.g., ATS stage, application time) and not derived from candidate quality. |

### Candidate Row Data Contract
| Field | Type | Description |
| --- | --- | --- |
| `candidate_id` | string | Canonical candidate identifier |
| `application_id` | string | ATS application identifier |
| `employer_id` | string | Employer context identifier |
| `job_role` | string | Role for filtering and context |
| `capability_summary` | array/object | Capability labels with lightweight coverage summary |
| `evidence_indicator` | object | Counts or indicators by verification state |

> **Invariant:** Candidate rows must always reference canonical candidate profiles after claim.

---

## 4.2 Capability -> Evidence Mapping
| Rule ID | Rule |
| --- | --- |
| RR-001 | Every displayed capability must map to one or more artifacts. |
| RR-002 | Evidence is supporting proof only, not a score signal. |
| RR-003 | Recruiter can open evidence directly from capability row/chip. |
| RR-004 | Capability without linked artifacts displays "No evidence available" state. |
| RR-005 | Evidence shown must correspond to canonical artifact representations (highest-trust version). |

### Capability Mapping Decision Table
| Condition | System behavior |
| --- | --- |
| Capability has one linked artifact | Show single evidence link target. |
| Capability has multiple linked artifacts | Show grouped evidence count and list links. |
| Capability has zero linked artifacts | Show explicit no-evidence state and prevent empty panel crash. |

---

## 4.3 Evidence Inspection UI (Split View / Master-Detail)
| Interaction requirement | Rule |
| --- | --- |
| List persistence | Candidate list remains visible while evidence panel is open. |
| Selected artifact focus | Selected artifact is highlighted in list and in panel context header. |
| Sequential navigation | Recruiter can navigate next/previous artifact without leaving context. |
| Context preservation | Returning from artifact detail does not reset filters, scroll, or selection. |
| Canonical display | Panel must display canonical artifact representation by default, with access to provenance-linked versions if available. |

### Evidence Panel State Table
| State | Entry condition | Display behavior |
| --- | --- | --- |
| `panel_closed` | No capability/evidence selected | Show list-only view |
| `panel_loading` | Evidence fetch in progress | Skeleton/loading placeholder |
| `panel_single_evidence` | Exactly one artifact linked | Show artifact detail with disabled next/prev |
| `panel_multi_evidence` | More than one artifact linked | Show artifact detail with next/prev navigation |
| `panel_no_evidence` | Capability has no artifacts | Show explicit no-evidence message |
| `panel_error` | Evidence retrieval failed | Show retry state and preserve list context |

### Interaction State Transition (Text Diagram)
`LIST_LOADED -> CANDIDATE_SELECTED -> CAPABILITY_SELECTED -> PANEL_LOADING -> (PANEL_SINGLE_EVIDENCE | PANEL_MULTI_EVIDENCE | PANEL_NO_EVIDENCE | PANEL_ERROR)`

---

## Verification Visibility Rules
| Rule ID | Rule |
| --- | --- |
| RR-006 | Verification state must be visible as trust metadata on evidence. |
| RR-007 | Verification state must not influence ordering, filtering, or prioritization in Phase 1. |

---

## Explicit Phase 1 Exclusion Rules
| Exclusion | Rule |
| --- | --- |
| Recommendation states | Do not use recommendation, hold, or manual-review system states for candidate evaluation. |
| Candidate ranking | Do not sort or prioritize candidates by model-derived score. |
| Automated filtering | Do not hide or remove candidates based on inferred quality. |
| Implicit scoring | Do not introduce proxy signals (confidence scores, strength indicators) that function as ranking. |