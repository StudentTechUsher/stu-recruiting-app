# Candidate Capability Profile Contract

## Purpose
Define the persistent, versioned, auditable Candidate capability profile derived from artifacts and used for role-conditioned fit projection.

## Design Principles
- Derived from evidence, not manually self-scored.
- Immutable snapshots for auditability.
- Freshness tracked at head/snapshot level.
- Multi-role projection support: one candidate snapshot can be compared against many role models without per-role recomputation.

## Storage Model (Implementation-Oriented)

### 1) Head Record
`candidate_capability_profiles` tracks current state.

| Field | Requirement |
| --- | --- |
| `profile_id` | Required candidate profile identifier (1 row per candidate). |
| `latest_snapshot_id` | Nullable pointer to latest computed snapshot. |
| `latest_fresh_snapshot_id` | Nullable pointer to latest successful fresh snapshot. |
| `freshness_state` | Required enum: `fresh`, `stale`, `recomputing`, `failed`. |
| `stale_reason` | Nullable reason code for stale/failed state. |
| `input_changed_at` | Nullable timestamp of most recent input change trigger. |
| `updated_at` | Required timestamp. |

### 2) Immutable Snapshot Record
`candidate_capability_profile_snapshots` stores one computation result per input/version state.

| Field | Requirement |
| --- | --- |
| `snapshot_id` | Required unique identifier. |
| `profile_id` | Required candidate profile identifier. |
| `snapshot_version` | Required monotonically increasing version number per profile. |
| `ontology_version` | Required ontology version used for compute. |
| `scoring_version` | Required scoring logic version used for compute. |
| `input_state_hash` | Required deterministic hash of effective inference input state. |
| `computation_reason` | Required reason (`initial`, `artifact_change`, `verification_change`, `ontology_change`, `scoring_change`, `identity_resolution_change`, `manual_refresh`). |
| `computed_at` | Required computation timestamp. |
| `summary_metrics` | Required rollup payload (for example `alignment_readiness`, coverage, confidence summary inputs). |

### 3) Axis Score Record
`candidate_capability_profile_axis_scores` stores compact numeric outputs.

| Field | Requirement |
| --- | --- |
| `snapshot_id` | Required snapshot reference. |
| `axis_id` | Required ontology axis ID. |
| `score_normalized` | Required normalized value in `0..1`. |
| `confidence` | Required confidence class (`low`, `moderate`, `high`) or numeric confidence value. |
| `evidence_count` | Required supporting evidence count for this axis. |

### 4) Axis Evidence Trace Record
`candidate_capability_profile_axis_evidence_links` stores traceability links.

| Field | Requirement |
| --- | --- |
| `snapshot_id` | Required snapshot reference. |
| `axis_id` | Required ontology axis ID. |
| `artifact_id` | Required linked artifact ID. |
| `link_reason` | Optional deterministic linkage reason (explicit mapping, type mapping, inferred family mapping). |

## `input_state_hash` Contract (Locked)
`input_state_hash` must represent the effective inference input state, including:
- artifact content/fingerprint
- active version pointer (`active_version_id`)
- verification status/tier and related trust metadata
- artifact presence/deletion/deactivation state
- identity association context that affects effective artifact set

The hash is not limited to raw evidence IDs.

## Recalculation Lifecycle (Async Queue)

### State Transitions
`fresh -> stale -> recomputing -> fresh`

Failure path: `recomputing -> failed` (retaining `latest_fresh_snapshot_id` for fallback reads).

### Recompute Triggers
- Artifact add/update/delete/deactivate/reactivate.
- Artifact active version pointer changes.
- Verification status/tier updates.
- Ontology version changes.
- Scoring version changes.
- Identity resolution changes that alter effective artifact set (merge/split/re-association).

### Trigger Handling Rules
1. Mark head record `stale` and set `input_changed_at`.
2. Enqueue deduplicated recompute job keyed by `profile_id`.
3. Worker computes snapshot from active evidence state.
4. Persist immutable snapshot + axis scores + evidence links.
5. Update head pointers and set state to `fresh`.

### Idempotency Rule
Create a new snapshot only when one or more of these change:
- `input_state_hash`
- `ontology_version`
- `scoring_version`

If unchanged, do not create duplicate snapshots; update freshness metadata only.

## Read Semantics
- Prefer `latest_fresh_snapshot_id` for user-facing evaluation.
- If head is `stale` or `recomputing`, show explicit recency/freshness cue and continue using last fresh snapshot until recompute completes.
- If head is `failed`, show fallback with retry signal and preserve auditability.

## Explicit Constraints
- No candidate ranking or automated hiring decisions.
- No per-role recomputation of candidate profile for standard role comparisons.
- No hidden snapshot mutation; snapshots are immutable.

## Cross-References
- `docs/system/capability-ontology.md`
- `docs/system/capability-model.md`
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
