# Capability Ontology Contract

## Purpose
Define the canonical, stable capability axis vocabulary used by Role capability models, Candidate capability profile snapshots, and role-conditioned fit calculation.

## Ontology Object Contract
| Field | Requirement |
| --- | --- |
| `ontology_version` | Required semantic or incrementing version string. |
| `published_at` | Required timestamp for ontology release. |
| `axes` | Required array of axis definitions. |
| `axes[].axis_id` | Required stable identifier (snake_case). |
| `axes[].label` | Required display label. |
| `axes[].axis_class` | Required classification (`core`, `domain`, `contextual`). |
| `axes[].description` | Required concise interpretation guidance. |
| `axes[].allowed_evidence_types` | Optional list of preferred artifact/evidence types. |
| `axes[].status` | Required lifecycle status (`active`, `deprecated`). |
| `axes[].deprecated_at` | Required when status is `deprecated`. |

## ID and Compatibility Invariants
| Rule ID | Rule |
| --- | --- |
| ONT-001 | `axis_id` values are immutable once published. |
| ONT-002 | Labels and descriptions may evolve without changing `axis_id`. |
| ONT-003 | Deprecated axes remain resolvable for historical snapshots. |
| ONT-004 | Role capability model axes must reference valid ontology `axis_id` values. |
| ONT-005 | Candidate capability snapshots must record the exact `ontology_version` used at computation time. |

## Normalization and Scale Rules
- Candidate axis scores are normalized to `0..1`.
- Role model `required_level` values are normalized to `0..1`.
- Fit computation can only compare values under the same ontology and scoring versions.

## Ontology Version Change Behavior (Locked)
- No cross-version projection is used for production fit calculation.
- Ontology version changes are treated as recompute triggers for Candidate capability profiles.
- Historical snapshots remain auditable and queryable in their native version context.

## Initial Shared Axis Set (Example v1)
| axis_id | label | axis_class |
| --- | --- | --- |
| `communication` | Communication | core |
| `collaboration` | Collaboration | core |
| `execution_reliability` | Execution Reliability | core |
| `problem_solving` | Problem Solving | domain |
| `business_judgment` | Business Judgment | domain |
| `data_communication` | Data Communication | domain |
| `operational_coordination` | Operational Coordination | domain |
| `technical_depth` | Technical Depth | domain |
| `systems_thinking` | Systems Thinking | domain |
| `research_methodology` | Research Methodology | domain |

## Anti-Patterns
- Creating role-specific ad hoc axes that do not exist in ontology.
- Reusing one `axis_id` for multiple meanings.
- Comparing snapshots and models across ontology versions without recompute.

## Cross-References
- `docs/system/capability-model.md`
- `docs/system/candidate-capability-profile.md`
- `docs/system/capability-derivation.md`
