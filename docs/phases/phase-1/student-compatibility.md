# Phase 1 Student Compatibility Specification

## Purpose
Define candidate-side constraints required to stay compatible with shared Evidence Profile, Capability Profile, coaching, and recruiter handoff contracts.

## Compatibility Mapping Matrix
| Student surface | Shared contract dependency | Compatibility requirement |
| --- | --- | --- |
| Capability Alignment Dashboard | Capability model + derivation + verification model | Displayed strengths and gaps must be derived from linked evidence only. |
| Evidence Profile | Evidence model + verification model | Artifact versions and provenance remain queryable and consistent. |
| Capability Selection Agent | Capability model + selection agent spec | Candidate target set is constrained to 1 to 2 active Capability Profiles. |
| Capability Fit Coaching | Evidence model + derivation + coaching agent spec | Coaching claims and actions are evidence-traceable and target-scoped. |
| Visibility authorization | Targeting and visibility workflow spec | Visibility action is controlled, target-specific, and auditable. |
| Claim flow | Canonical profile contract | Callback claim converges to one canonical profile deterministically. |

## Student Phase 1 Invariants
| Invariant ID | Rule |
| --- | --- |
| SPC-001 | Student landing route remains `/student/dashboard`. |
| SPC-002 | Candidate and recruiter surfaces reflect identical capability-evidence relationships for same profile state. |
| SPC-003 | No student-only hidden transform layer may alter recruiter-facing evidence meaning. |
| SPC-004 | No scoring, ranking, or proxy prioritization is introduced. |
| SPC-005 | Verification and tier metadata are trust labels only and do not change inclusion logic. |
| SPC-006 | Candidate may keep at most 2 active Capability Profiles at any time. |
| SPC-007 | Open Profile Visibility to Selected Employers can target one selected active profile per request. |

## Agent-Driven Guidance Compatibility Rules
| Rule ID | Rule |
| --- | --- |
| SPC-AG-001 | Capability Selection Agent outputs must map to valid Capability Profile IDs. |
| SPC-AG-002 | Capability Fit Coaching outputs must map actions to expected evidence artifacts. |
| SPC-AG-003 | Agent responses must not imply guaranteed employment outcomes. |
| SPC-AG-004 | Agent-facing rationale shown to user must be evidence-backed and non-score-centric. |

## Internal Contracts
| Contract | Requirement |
| --- | --- |
| Dashboard read contract | Exposes target context, capability-evidence linkage, trust cues, and traceable evidence IDs. |
| Selection contract | Enforces max-2 active target state transitions. |
| Coaching contract | Produces structured strengths, gaps, actions, and expected evidence outputs. |
| Visibility authorization contract | Records candidate consent and selected target context for handoff. |

## Traceability Requirements
| Requirement | Rule |
| --- | --- |
| Strength and gap traceability | Each claim references supporting evidence IDs or explicit no-evidence marker. |
| Coaching traceability | Each recommendation references target capability context and expected evidence. |
| Auditability | Historical artifact versions remain provenance-linked and inspectable. |

## Low-Data Behavior Requirements
| State | Expected behavior |
| --- | --- |
| No target selected | Prompt target selection and explain 1 to 2 focus rule. |
| No evidence | Coverage and trust show zero-state with Add evidence emphasis. |
| Limited evidence | Emphasize verification and evidence-strengthening actions. |

## Required Compatibility Statement
`Recruiter-facing Decision-Ready Candidate Package claims are explainable by the same candidate-visible evidence linkage model.`

## Acceptance Criteria
| Criteria ID | Criteria |
| --- | --- |
| SPC-AC-001 | Capability derivation outputs remain deterministic and non-ranking. |
| SPC-AC-002 | Dashboard and coaching claims are explainable by linked evidence IDs. |
| SPC-AC-003 | Target selection enforces max-2 active Capability Profiles. |
| SPC-AC-004 | Candidate-generated evidence remains recruiter-consumable without hidden transform logic. |
| SPC-AC-005 | Visibility action remains controlled and target-specific with audit records. |

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
