# Capability Model Contract

## Purpose
Define shared capability taxonomy and IDs used by student dashboard and recruiter evidence review.

## Capability Classes
| Class | Description | Phase 1 source |
| --- | --- | --- |
| Soft-skill baseline | Core universal capabilities shown for all students. | Static baseline set |
| Role-required capability | Capabilities required by selected target roles. | Static role mapping contract |
| Derived evidence capability | Capability labels inferred from evidence mapping. | Deterministic derivation contract |

## Soft-Skill Baseline (Phase 1)
| capability_id | Label |
| --- | --- |
| `soft_communication` | Communication |
| `soft_collaboration` | Collaboration |
| `soft_problem_solving` | Problem Solving |
| `soft_ownership` | Ownership & Reliability |

## Role Capability Contract Shape
| Field | Requirement |
| --- | --- |
| `role_id` | Required target role identifier. |
| `role_label` | Required display label. |
| `required_capabilities` | Required array of capability objects. |
| `required_capabilities[].capability_id` | Required stable capability identifier. |
| `required_capabilities[].label` | Required display label. |
| `required_capabilities[].class` | Required value (`role_required`). |

## Multi-Role Rule
| Condition | Capability axis behavior |
| --- | --- |
| One selected role | Use required capabilities from that role. |
| Multiple selected roles | Use union across roles, deduplicated by `capability_id`. |
| No selected roles | Show soft-skill baseline only. |

## Shared ID Invariants
| Invariant ID | Rule |
| --- | --- |
| CAP-001 | `capability_id` values must be stable across student and recruiter contexts. |
| CAP-002 | Display labels may evolve, but IDs remain backward compatible. |
| CAP-003 | Student and recruiter views must resolve identical capability IDs for the same evidence linkage. |
