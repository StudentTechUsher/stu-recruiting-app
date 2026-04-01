# Recruiter Review Experience (Phase 1)

## Purpose
Define recruiter-side review behavior for evidence-backed candidate evaluation, including controlled intake of visibility-authorized Decision-Ready Candidate Packages.

## 1. Candidate Intake Modes
| Intake mode | Description | Constraints |
| --- | --- | --- |
| ATS-linked review | Standard recruiter list from ATS-linked applications. | Deterministic ordering, no ranking outputs. |
| Visibility-authorized package intake | Candidate-triggered Open Profile Visibility to Selected Employers handoff for one selected target. | Operator-mediated and curated, not mass broadcast. |

## 2. Candidate List View
| Requirement | Rule |
| --- | --- |
| Job context filtering | Recruiter can filter by job and selected target context. |
| Candidate source | Candidates come from ATS links or approved visibility handoff queue. |
| Summary content | Each row includes target context, capability summary, and evidence trust indicators. |
| Ranking behavior | No score, rank position, or auto-filter state shown. |
| List ordering | Deterministic ordering (for example ATS stage and application time, then visibility intake time where relevant). |

### Candidate Row Data Contract
| Field | Type | Description |
| --- | --- | --- |
| `candidate_id` | string | Canonical candidate identifier |
| `application_id` | string or null | ATS application identifier when available |
| `employer_id` | string | Employer context identifier |
| `capability_profile_id` | string or null | Selected target capability profile context |
| `company_role_target` | object | Company and role labels for selected target |
| `capability_summary` | array or object | Capability strengths and gap cues |
| `evidence_indicator` | object | Verification state and tier indicators |
| `intake_source` | enum | `ats_linked` or `visibility_authorized` |

> **Invariant:** Candidate rows reference canonical profiles after claim.

## 3. Capability to Evidence Mapping
| Rule ID | Rule |
| --- | --- |
| RR-001 | Every displayed capability maps to one or more artifacts or explicit no-evidence state. |
| RR-002 | Evidence is supporting proof, not ranking signal. |
| RR-003 | Recruiter can open evidence from capability row or package summary section. |
| RR-004 | Package view must preserve candidate-facing evidence traceability semantics. |

## 4. Evidence Inspection UI (Split View)
| Interaction requirement | Rule |
| --- | --- |
| List persistence | Candidate list remains visible while detail panel is open. |
| Selected artifact focus | Selected artifact is highlighted across list and panel context. |
| Sequential navigation | Recruiter can navigate linked artifacts without losing context. |
| Context preservation | Return from detail preserves filters, scroll, and selection state. |
| Canonical display | Show canonical artifact by default, with provenance-linked versions available. |

### Evidence Panel State Table
| State | Entry condition | Display behavior |
| --- | --- | --- |
| `panel_closed` | No selection | List-only view |
| `panel_loading` | Detail fetch in progress | Skeleton state |
| `panel_single_evidence` | One artifact linked | Detail with no next or prev controls |
| `panel_multi_evidence` | Multiple artifacts linked | Detail with next or prev controls |
| `panel_no_evidence` | No linked artifacts | Explicit no-evidence message |
| `panel_error` | Fetch failure | Retry state with preserved context |

## 5. Decision-Ready Candidate Package Intake
| Requirement | Rule |
| --- | --- |
| Intake control | Package intake requires prior candidate visibility authorization and operator mediation. |
| Target specificity | One package corresponds to one selected company-role target. |
| Package contents | Include target context, evidence-backed strengths, evidence gaps, and key verification cues. |
| Anti-spam guard | System limits repeated visibility requests for same target within policy window. |

## 6. Verification Visibility Rules
| Rule ID | Rule |
| --- | --- |
| RR-VER-001 | Verification state and tier are visible as trust metadata. |
| RR-VER-002 | Verification metadata must not alter inclusion or ordering logic. |
| RR-VER-003 | Weak evidence cues remain visible and distinguishable from verified evidence. |

## 7. Explicit Exclusion Rules
| Exclusion | Rule |
| --- | --- |
| Recommendation states as ranking | Do not use recommendation or confidence labels as ranking outputs. |
| Candidate ranking | Do not sort candidates by model-derived quality score. |
| Automated filtering | Do not hide or remove candidates based on inferred quality. |
| Mass visibility intake | Do not treat visibility action as broadcast mechanism. |

## Cross-References
- `docs/system/evidence-model.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/phases/phase-1/recruiter-compatibility.md`
- `app/api/recruiter/README.md`
