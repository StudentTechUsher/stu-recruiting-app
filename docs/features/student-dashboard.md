# Student Dashboard (Capability Alignment Dashboard) Specification

## Purpose
Define candidate landing behavior that emphasizes evidence-backed progress against 1 to 2 selected Capability Profiles.

## Route and Placement
| Rule | Requirement |
| --- | --- |
| Landing route | Authenticated student default route is `/student/dashboard`. |
| Primary intent | Show evidence-backed strengths, gaps, and next actions for active targets. |
| Focus constraint | Dashboard supports at most two active Capability Profiles at one time. |
| No dead-end | Dashboard provides direct CTAs to evidence actions, target management, and coaching surfaces. |

## Dashboard Sections
| Section | Required content |
| --- | --- |
| Active target header | Display selected Capability Profiles and active target count (`1` or `2`). |
| Capability evidence view | Show capability coverage and trust breakdown scoped to selected target. |
| Evidence quality strip | Show strong, limited, and insufficient evidence cues. |
| Next actions rail | Prioritized coaching actions linked to expected evidence artifacts. |
| Explainability panel | Why this gap or strength is shown, with evidence references. |

## Dashboard Data Contract
| Field | Requirement |
| --- | --- |
| `active_capability_profiles` | Required list of active target summaries (max 2). |
| `active_capability_profiles[].capability_profile_id` | Required target ID. |
| `active_capability_profiles[].company_label` | Required target company display label. |
| `active_capability_profiles[].role_label` | Required target role label. |
| `axes[].capability_id` | Required stable capability ID. |
| `axes[].covered` | Required boolean derived from evidence linkage presence. |
| `axes[].supporting_evidence_ids` | Required traceability list. |
| `axes[].verification_breakdown` | Required trust counts. |
| `axes[].evidence_confidence` | Required confidence class for candidate-facing evidence quality cues. |

## KPI Definitions
| KPI | Definition |
| --- | --- |
| Capability evidence coverage | `covered_capabilities / total_target_capabilities` |
| Verified evidence share | `verified_linked_evidence / total_linked_evidence` |
| Limited evidence share | `limited_or_insufficient_capabilities / total_target_capabilities` |
| Last updated | Most recent linked evidence update timestamp |

## CTA Decision Table
| Condition | Primary CTA | Secondary CTA |
| --- | --- | --- |
| No active target | Select your first Capability Profile | Review Evidence Profile |
| One active target, no evidence | Add evidence for selected target | Open Capability Selection Agent |
| Active target with limited evidence | Open Capability Fit Coaching | Verify key evidence |
| Two active targets with progress | Compare target gaps | Open Capability Fit Coaching |

## Explainability Requirements
| Requirement | Rule |
| --- | --- |
| Evidence traceability | Every strength and gap must link to evidence IDs or explicit no-evidence marker. |
| Clear language | Use strengths, gaps, trust, and next actions language. Avoid ranking framing. |
| Tradeoff visibility | If two active targets exist, show tradeoffs in evidence requirements. |

## Deterministic Low-Data States
| State | Required behavior |
| --- | --- |
| `no_target_selected` | Prompt target selection and explain max-2 focus model. |
| `no_evidence` | Show add-evidence onboarding and keep dashboard structure visible. |
| `limited_evidence` | Surface verification and artifact improvement actions with rationale. |
| `progressing` | Show strengths and actionable remaining gaps. |

## Explicit Constraints
| Constraint | Rule |
| --- | --- |
| Ranking and score outputs | Dashboard must not emit candidate ranking or opaque score-centric framing. |
| Hidden transforms | Displayed claims must be traceable to linked evidence and capability profile context. |
| Over-targeting | Dashboard must not allow more than two active targets. |

## Cross-References
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/student-evidence-profile.md`
