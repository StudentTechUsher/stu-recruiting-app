# Capability Derivation Contract

## Purpose
Define how Evidence Profile records are deterministically mapped to capability coverage against selected Capability Profiles without ranking or score-centric user framing.

## Inputs
| Input | Source |
| --- | --- |
| Evidence records (`artifact_id`, `artifact_type`, `artifact_data`) | Evidence model |
| Artifact provenance and metadata | Evidence model |
| Verification state and verification tier | Verification model |
| Selected Capability Profiles (`active_capability_profiles`) | Capability model |
| Baseline capability set for low-data fallback | Capability model |

## Outputs
| Output | Definition |
| --- | --- |
| Capability coverage | Presence and evidence sufficiency per capability within each selected profile. |
| Capability evidence linkage | Evidence IDs mapped to each capability and capability profile context. |
| Capability trust breakdown | Counts by verification state and verification tier per capability. |
| Coaching derivation context | Structured strength and gap candidates for Capability Fit Coaching. |
| Explainability payload | Traceable references used in dashboard, coaching, and recruiter package summaries. |

## Derivation Scope Rules
| Rule ID | Rule |
| --- | --- |
| CD-SCOPE-001 | Primary derivation scope is the set of selected active Capability Profiles. |
| CD-SCOPE-002 | If no active profile exists, derivation uses baseline capabilities for onboarding-safe guidance only. |
| CD-SCOPE-003 | Capability coverage is derived from linked evidence presence and quality metadata, not candidate rank signals. |
| CD-SCOPE-004 | Verification state and tier affect trust interpretation, not candidate inclusion or ordering. |

## Deterministic Derivation Rules
| Rule ID | Rule |
| --- | --- |
| CD-001 | Capability set equals union of capabilities from active Capability Profiles, deduplicated by `capability_id`. |
| CD-002 | Evidence links use explicit `capability_id` mapping when present, then deterministic artifact-type mapping, then `other_evidence` fallback. |
| CD-003 | Capability presence requires one or more linked evidence records. |
| CD-004 | Evidence sufficiency classification uses explicit rules for weak, pending, and verified evidence tiers. |
| CD-005 | No probabilistic ranking or hidden weighting is allowed in user-facing interpretation. |

## Internal Computation vs User-Facing Interpretation
| Category | Internal computation allowed | User-facing requirement |
| --- | --- | --- |
| Coverage computation | Compute counts, sufficiency flags, and trust breakdowns. | Present strengths, gaps, and evidence clarity. |
| Similarity and fit heuristics | Allowed for internal prioritization and agent orchestration. | Do not expose opaque numeric fit scores as primary UX narrative. |
| Prioritization | Allowed to order suggested actions in coaching. | Explain priority with evidence-backed rationale and expected artifact outcomes. |

## Traceability Requirements
| Rule ID | Requirement |
| --- | --- |
| CD-TR-001 | Every derived capability entry must include linked evidence IDs. |
| CD-TR-002 | No strength or gap claim may be emitted without traceable evidence references or explicit no-evidence marker. |
| CD-TR-003 | Student dashboard, coaching surfaces, and recruiter package summaries must reference the same linkage model for a given profile state. |

## No-Scoring and No-Ranking Constraints
| Constraint ID | Rule |
| --- | --- |
| CD-NR-001 | Do not compute or expose candidate ranking from capability derivation outputs. |
| CD-NR-002 | Do not expose opaque composite scores as primary user-facing framing. |
| CD-NR-003 | Do not use derivation outputs for automated accept or reject actions. |

## Compatibility Invariant
`Recruiter-facing Decision-Ready Candidate Package capability claims must be explainable by the same evidence linkage and trust semantics shown in candidate-facing surfaces.`

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/system/capability-model.md`
- `docs/system/evidence-model.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/recruiter-review-experience.md`
