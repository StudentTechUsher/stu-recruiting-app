# Capability Model Contract

## Purpose
Define the company-role-specific Capability Profile contract and active target rules used by candidate selection, coaching, and recruiter decision readiness workflows.

## Replacement Note
Role-only capability framing from earlier phase documents is deprecated.

All new target modeling must use Capability Profile semantics where one profile represents one company plus one role target.

## Capability Profile Definition
| Field | Requirement |
| --- | --- |
| `capability_profile_id` | Required stable identifier for one company-role capability profile. |
| `company_id` | Required company identifier. |
| `company_label` | Required display label. |
| `role_id` | Required role identifier scoped to company context. |
| `role_label` | Required role display label. |
| `capabilities` | Required list of capability expectations. |
| `capabilities[].capability_id` | Required stable capability identifier. |
| `capabilities[].label` | Required capability display label. |
| `capabilities[].priority` | Required priority class (`core`, `supporting`, `contextual`). |
| `capabilities[].expected_evidence_types` | Required list of preferred evidence types for credibility. |
| `version` | Required version number or semantic label. |
| `is_active` | Required publish status. |

## Capability Classes
| Class | Description | Source |
| --- | --- | --- |
| Baseline capability | Cross-role baseline capability family used for low-data orientation. | Shared taxonomy |
| Target capability | Capability expectation from selected Capability Profiles. | Capability Profile contract |
| Derived capability | Capability inferred from evidence linkage with deterministic mapping. | Derivation contract |

## Candidate Active Target Contract
| Field | Requirement |
| --- | --- |
| `active_capability_profiles` | Required array of active selected profile records. |
| `active_capability_profiles[].capability_profile_id` | Required selected profile ID. |
| `active_capability_profiles[].selection_status` | Required status (`recommended`, `candidate`, `active`, `archived`). |
| `active_capability_profiles[].selected_at` | Required timestamp when active. |
| `active_capability_profiles[].selection_source` | Required source (`self_select`, `selection_agent`, `operator_assist`). |

## Active Target Constraints
| Constraint ID | Rule |
| --- | --- |
| CAP-PROFILE-001 | Candidate may have at most 2 `active` Capability Profiles at any time. |
| CAP-PROFILE-002 | Candidate must have at least 1 `active` Capability Profile before visibility action. |
| CAP-PROFILE-003 | Status transitions are explicit and auditable. |
| CAP-PROFILE-004 | When attempting to activate a third target, system must require archiving or replacing one active target first. |

## Selection Status and Transition Rules
| From | Trigger | To | Rule |
| --- | --- | --- | --- |
| `recommended` | Candidate accepts recommendation | `candidate` | Candidate acknowledges target for consideration. |
| `candidate` | Candidate confirms focus | `active` | Enforce max-2 constraint. |
| `active` | Candidate replaces or retires target | `archived` | Preserve history and rationale. |
| `archived` | Candidate reactivates | `active` | Enforce max-2 constraint and record new timestamp. |

Text diagram:
`RECOMMENDED -> CANDIDATE -> ACTIVE -> ARCHIVED`

## Shared ID Invariants
| Invariant ID | Rule |
| --- | --- |
| CAP-ID-001 | `capability_profile_id` is stable across candidate and recruiter contexts. |
| CAP-ID-002 | `capability_id` values remain stable across derivation, coaching, and recruiter review. |
| CAP-ID-003 | Display labels may evolve, IDs remain backward compatible. |

## Compatibility Rules
| Rule ID | Rule |
| --- | --- |
| CAP-COMP-001 | Candidate and recruiter systems must resolve the same capability IDs for the same capability profile version. |
| CAP-COMP-002 | Evidence linkage semantics are shared across dashboard, coaching, and recruiter package views. |
| CAP-COMP-003 | Capability Profile updates must not introduce ranking behavior. |

## Explicit Exclusions
| Exclusion | Rule |
| --- | --- |
| Generic role template as final target | Not allowed as final target object in new workflows. |
| Ranking score fields | Not allowed in Capability Profile user-facing outputs. |
| Automated hiring decisions | Not allowed. Capability Profiles guide readiness and evidence planning only. |

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/system/capability-derivation.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
