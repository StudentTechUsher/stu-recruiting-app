# Role Capability Model Contract

## Purpose
Define the company-and-role target contract used for alignment and fit calculation against a persistent Candidate capability profile.

## Replacement Note
Legacy phrasing that treated role targets as generic "Capability Profiles" is replaced by **Role capability model** terminology.

Implementation-facing schema fields may still use `capability_model_*` names during migration, but product and spec language should use Role capability model.

## Role Capability Model Definition
| Field | Requirement |
| --- | --- |
| `capability_model_id` | Required stable identifier for one company-role target model. |
| `company_id` | Required company identifier. |
| `role_id` | Required role identifier in company context. |
| `role_name` | Required role display label. |
| `model_name` | Required human-readable model label. |
| `description` | Optional model intent description. |
| `required_evidence` | Optional role-level evidence expectations. |
| `thresholds` | Optional labeled thresholds for readiness interpretation (not ranking). |
| `axes` | Required array of ontology-bound axis definitions. |
| `axes[].axis_id` | Required ontology axis identifier. |
| `axes[].required_level` | Required expected level on axis, normalized `0..1`. |
| `axes[].weight` | Required axis importance for rollup contribution. |
| `axes[].required_evidence_types` | Optional axis-level preferred evidence types. |
| `is_active` | Required publish flag. |
| `version_number` | Required version number. |

## Axis Semantics (Locked)
| Term | Meaning |
| --- | --- |
| `required_level` | Target proficiency/evidence-backed level expected for the role on one axis. |
| `weight` | Relative importance of that axis in rollup alignment. |

`required_level` and `weight` are distinct and must never be conflated.

## Weight Normalization
Role model rollup math must normalize weights using one of the equivalent forms:

1. `normalized_weight_i = weight_i / sum(all_weights)` and `alignment_score = sum(normalized_weight_i * attainment_i)`
2. `alignment_score = sum(weight_i * attainment_i) / sum(all_weights)`

Both yield alignment in `0..1` when `attainment_i` is in `0..1`.

## Required-Level Edge Behavior
- If `required_level > 0`: `attainment = min(candidate_score / required_level, 1)`.
- If `required_level = 0`: `attainment = 1` by definition.

## Compatibility and Versioning Rules
| Rule ID | Rule |
| --- | --- |
| RCM-001 | Every `axis_id` must resolve in the active Capability ontology version. |
| RCM-002 | Axis IDs are stable across model versions; labels may evolve in ontology metadata. |
| RCM-003 | Role model updates create a new versioned record. |
| RCM-004 | Role model changes do not mutate historical Candidate capability snapshots. |
| RCM-005 | Role model evaluation must use Candidate capability snapshots computed for the current ontology/scoring version. |

## Legacy Compatibility Note
Existing payloads with `weights` maps remain valid during transition, but canonical contract is `axes[]` with explicit `required_level` and `weight`.

## Example Role Capability Model
```json
{
  "capability_model_id": "a2ab5f88-1111-4ac7-9d2f-111111111111",
  "company_id": "e5af10c9-59b6-498c-acb9-86a66ab5de81",
  "role_id": "4d62c9c3-2222-41a4-9e4e-222222222222",
  "role_name": "Business Operations Analyst",
  "model_name": "Lucid Software - Business Operations Analyst",
  "description": "Early-career operations profile focused on planning, coordination, process clarity, and reliable execution.",
  "required_evidence": [
    "Planning, coordination, or process project artifacts",
    "Evidence of workflow ownership or process improvement",
    "Examples of stakeholder coordination and dependable follow-through",
    "Communication of process insights or operational recommendations"
  ],
  "thresholds": {
    "emerging_max": 0.54,
    "developing_max": 0.69,
    "ready_max": 0.84
  },
  "axes": [
    { "axis_id": "collaboration", "required_level": 0.7, "weight": 16 },
    { "axis_id": "problem_solving", "required_level": 0.75, "weight": 18 },
    { "axis_id": "business_judgment", "required_level": 0.65, "weight": 12 },
    { "axis_id": "data_communication", "required_level": 0.7, "weight": 14 },
    { "axis_id": "execution_reliability", "required_level": 0.8, "weight": 22 },
    { "axis_id": "operational_coordination", "required_level": 0.75, "weight": 18 }
  ],
  "version_number": 4,
  "is_active": true
}
```

## Explicit Exclusions
- Using `weight` as a target-shape proxy.
- Candidate ranking or automated hiring decisions.
- Opaque score-only framing without evidence traceability and confidence context.

## Cross-References
- `docs/system/capability-ontology.md`
- `docs/system/candidate-capability-profile.md`
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
