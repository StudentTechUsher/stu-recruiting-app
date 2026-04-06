# Student Dashboard (Capability Alignment Dashboard) Specification

## Purpose
Define candidate landing behavior that emphasizes evidence-backed progress against selected Role capability models using a persistent Candidate capability profile.

## Route and Placement
| Rule | Requirement |
| --- | --- |
| Landing route | Authenticated student default route is `/student/dashboard`. |
| Primary intent | Show explainable gaps, contributions, confidence, and evidence traceability for active targets. |
| Focus constraint | Dashboard supports at most two active role targets at one time. |
| No dead-end | Dashboard provides direct CTAs to evidence actions, target management, and coaching surfaces. |

## Dashboard Data Contract
| Field | Requirement |
| --- | --- |
| `active_capability_profiles` | Required list of active target summaries (max 2; legacy field name retained). |
| `active_capability_profiles[].capability_profile_id` | Required target ID. |
| `active_capability_profiles[].company_label` | Required target company display label. |
| `active_capability_profiles[].role_label` | Required target role label. |
| `candidate_profile_snapshot.snapshot_id` | Required snapshot used for evaluation. |
| `candidate_profile_snapshot.ontology_version` | Required ontology version for displayed fit. |
| `candidate_profile_snapshot.scoring_version` | Required scoring version for displayed fit. |
| `candidate_profile_snapshot.freshness_state` | Required freshness state (`fresh`, `stale`, `recomputing`, `failed`). |
| `fit.alignment_score` | Required rollup score in `0..1`. |
| `fit.overall_alignment` | Optional legacy alias of `alignment_score`. |
| `fit.per_axis[].axis_id` | Required stable capability axis ID. |
| `fit.per_axis[].candidate_score` | Required normalized candidate score `0..1`. |
| `fit.per_axis[].required_level` | Required normalized required level `0..1`. |
| `fit.per_axis[].gap` | Required signed difference `candidate_score - required_level`. |
| `fit.per_axis[].attainment` | Required bounded attainment `0..1`. |
| `fit.per_axis[].weighted_contribution` | Required normalized axis contribution. |
| `fit.per_axis[].confidence_flag` | Required confidence state (including `low_confidence` when applicable). |
| `fit.explanation.confidence_summary` | Required confidence summary for rollup interpretation. |
| `fit.explanation.evidence_summary` | Required evidence trace summary and drill-down references. |

## Primary Visualization Hierarchy (Locked)
| Priority | Visualization | Purpose |
| --- | --- | --- |
| 1 | Gap bar chart | Show deficits/surplus by axis relative to required level. |
| 1 | Contribution chart | Explain which axes drive `alignment_score`. |
| 1 | Confidence view | Surface uncertainty and low-confidence axes. |
| 1 | Evidence drill-down | Show supporting evidence references per axis. |
| 2 | Radar chart (gated) | Optional summary-only compact shape view. |

## Radar Chart Gating Rules
Radar is allowed only when all conditions are true:
1. Axis set is fixed.
2. Axis order is fixed.
3. Normalized scales are shared across compared views.
4. Every axis has defined `required_level`.
5. Chart is used as summary only, not as ranking/decision engine.

Radar must not be the default decision visual.

## KPI and Rollup Definitions
| KPI | Definition |
| --- | --- |
| Alignment score | `sum(normalized_weight_i * attainment_i)` (`0..1`) |
| Capability evidence coverage | `covered_capabilities / total_target_capabilities` |
| Verified evidence share | `verified_linked_evidence / total_linked_evidence` |
| Low-confidence axis share | `low_confidence_axes / total_target_axes` |
| Last updated | Snapshot `computed_at` plus freshness state |

## Explainability and Confidence Requirements
| Requirement | Rule |
| --- | --- |
| Evidence traceability | Every strength/gap claim links to evidence refs or explicit no-evidence marker. |
| Confidence guardrail | Low-confidence axes are visually flagged and cannot be framed as strong. |
| Freshness transparency | Stale/recomputing states must be visible to users. |
| Language | Use strengths, gaps, confidence, and next actions. Avoid ranking narrative. |

## Deterministic Low-Data States
| State | Required behavior |
| --- | --- |
| `no_target_selected` | Prompt role target selection and explain max-2 focus model. |
| `no_evidence` | Show add-evidence onboarding with stable dashboard layout. |
| `limited_confidence` | Surface confidence warnings with verification/add-evidence actions. |
| `stale_profile` | Show last fresh snapshot with staleness indicator and refresh progress. |
| `progressing` | Show strengths and actionable remaining gaps. |

## Explicit Constraints and Anti-Patterns
- Do not treat role `weight` as target shape.
- Do not use radar as primary decision surface.
- Do not show candidate ranking or automated decision outputs.
- Do not hide freshness or confidence uncertainty.

## Cross-References
- `docs/system/capability-model.md`
- `docs/system/capability-ontology.md`
- `docs/system/candidate-capability-profile.md`
- `docs/system/capability-derivation.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
