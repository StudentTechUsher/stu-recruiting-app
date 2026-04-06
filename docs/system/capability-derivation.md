# Capability Derivation and Fit Contract

## Purpose
Define the two-stage deterministic pipeline:
1. derive a versioned Candidate capability profile snapshot from artifacts
2. evaluate role-conditioned fit by comparing that snapshot against a Role capability model

This contract is evidence-first and explainable. It is not a ranking system.

## Stage A: Candidate Capability Derivation

### Inputs
| Input | Source |
| --- | --- |
| Active artifacts and active artifact versions | Evidence model |
| Artifact provenance and verification metadata | Evidence model + verification model |
| Capability ontology (`ontology_version`) | Capability ontology contract |
| Scoring logic (`scoring_version`) | Derivation runtime config |
| Identity association state | Canonical profile / identity model |

### Outputs
| Output | Definition |
| --- | --- |
| Candidate capability snapshot | Immutable versioned snapshot with axis scores and trace links |
| Axis confidence + evidence counts | Per-axis quality context |
| Snapshot rollup summary | Coverage and confidence summary inputs |
| `input_state_hash` | Hash of effective inference input state |

### Derivation Rules
| Rule ID | Rule |
| --- | --- |
| CD-A-001 | Derivation must run against active evidence state only. |
| CD-A-002 | Axis scores must be normalized to `0..1`. |
| CD-A-003 | Snapshot must record `ontology_version` and `scoring_version`. |
| CD-A-004 | Every axis claim must remain evidence-traceable through snapshot evidence-link records. |
| CD-A-005 | Snapshot writes are immutable; recomputation creates new snapshot versions. |

## Stage B: Role-Conditioned Fit Evaluation

### Inputs
| Input | Source |
| --- | --- |
| Candidate capability snapshot (latest fresh) | Candidate capability profile contract |
| Role capability model | Capability model contract |

### Per-Axis Outputs
For each `axis_id` present in the role model:
- `candidate_score`
- `required_level`
- `gap`
- `attainment`
- `weighted_contribution`
- `confidence_flag` (for example `low_confidence`)

### Rollup and Explanation Outputs
- Rollup: `alignment_score` (`0..1`)
- Legacy alias: `overall_alignment` may be emitted for compatibility
- Explanation: `confidence_summary`, `evidence_summary`

## Fit Math (Locked)
```text
normalized_weight_i = weight_i / sum(all_weights)

gap_i = candidate_score_i - required_level_i
- gap_i < 0: deficit
- gap_i = 0: meets expectation
- gap_i > 0: surplus (informational only)

if required_level_i > 0:
  attainment_i = min(candidate_score_i / required_level_i, 1)
if required_level_i = 0:
  attainment_i = 1

weighted_contribution_i = normalized_weight_i * attainment_i

alignment_score = sum(weighted_contribution_i)   // range 0..1
```

Surplus does not increase attainment beyond `1`.

## Confidence Guardrails
| Rule ID | Rule |
| --- | --- |
| CD-B-001 | Axis must be flagged `low_confidence` when confidence is below threshold or evidence count is below minimum evidence rule. |
| CD-B-002 | Low-confidence axes cannot be presented as strong support in user-facing summaries. |
| CD-B-003 | Rollup outputs must publish confidence context (`confidence_summary`) alongside `alignment_score`. |
| CD-B-004 | Weak evidence must not silently inflate interpretation confidence. |

## Ontology and Version Compatibility (Locked)
- Production evaluation does not project snapshots across ontology versions.
- Ontology or scoring version change is a recompute trigger.
- Historical snapshots remain auditable in their native version context.

## Freshness and Fallback Rules
- Prefer latest `fresh` snapshot for fit evaluation.
- If head state is `stale` or `recomputing`, evaluate against latest fresh snapshot and surface staleness.
- If head state is `failed`, return fallback with retry signal and no silent freshness claim.

## Recompute Trigger Matrix
| Trigger | Recompute required |
| --- | --- |
| Artifact add/update/delete/deactivate/reactivate | Yes |
| Active artifact version pointer change | Yes |
| Verification status or tier change | Yes |
| Ontology version change | Yes |
| Scoring version change | Yes |
| Identity merge/split/re-association altering effective artifact set | Yes |

## Worked Example (Business Operations Analyst)
Given one axis:

```json
{
  "axis_id": "execution_reliability",
  "required_level": 0.8,
  "weight": 22,
  "candidate_score": 0.6
}
```

Derived values:
- `gap = 0.6 - 0.8 = -0.2` (deficit)
- `attainment = min(0.6 / 0.8, 1) = 0.75`
- `weighted_contribution = normalized_weight * 0.75`

## Explicit Exclusions
- Candidate ranking or automated filtering.
- Weight-as-target-shape modeling.
- Max-based user capability scoring as primary fit method.
- Mixing raw evidence payloads directly into capability axes without ontology mapping.
- Opaque single-score output without explanation and confidence context.

## Cross-References
- `docs/system/capability-ontology.md`
- `docs/system/capability-model.md`
- `docs/system/candidate-capability-profile.md`
- `docs/system/evidence-model.md`
