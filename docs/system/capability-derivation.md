# Capability Derivation Contract

## Purpose
Define how evidence records are deterministically converted into capability signal without scoring or ranking.

## Inputs
| Input | Source |
| --- | --- |
| Evidence records (`artifact_id`, `artifact_type`, `artifact_data`) | Evidence model |
| Artifact metadata (`source`, typed fields, provenance refs) | Evidence model |
| Verification state (`verified`/`pending`/`unverified`) | Verification model |
| Selected target roles | Student profile targets |
| Soft-skill baseline | Capability model |

## Outputs
| Output | Definition |
| --- | --- |
| Capability coverage | Boolean coverage per capability (`covered` if one or more linked evidence records). |
| Capability evidence linkage counts | Count of supporting evidence records per capability. |
| Capability trust breakdown | Per capability counts/shares by verification state. |
| Radar axis payload | Axis value + supporting evidence IDs for traceability. |

## Deterministic Derivation Rules
| Rule ID | Rule |
| --- | --- |
| CD-001 | Role-required axis set = union of selected role capabilities, deduplicated by `capability_id`. |
| CD-002 | If no roles are selected, axis set = soft-skill baseline only. |
| CD-003 | Capability existence is derived from evidence linkage presence, not verification status. |
| CD-004 | Verification affects trust metrics only. |
| CD-005 | No probabilistic or learned ranking/scoring function is allowed. |

## Evidence-to-Capability Mapping Precedence
| Priority | Mapping rule |
| --- | --- |
| 1 | Use explicit `capability_id` on evidence record when present. |
| 2 | Else map by deterministic `artifact_type -> capability_id` rule set. |
| 3 | Else map to fallback capability `other_evidence`. |

## Traceability Requirement
| Rule ID | Requirement |
| --- | --- |
| CD-TR-001 | Every radar axis must include `supporting_evidence_ids`. |
| CD-TR-002 | No non-zero or non-empty axis value may be emitted without linked evidence IDs. |
| CD-TR-003 | Student and recruiter surfaces must expose the same capability-evidence relationships. |

## No-Scoring/No-Ranking Constraints
| Constraint ID | Rule |
| --- | --- |
| CD-NR-001 | Do not compute candidate score from capability values. |
| CD-NR-002 | Do not rank capabilities or candidates by derived confidence/strength values. |
| CD-NR-003 | Do not apply hidden weighting/prioritization outside explicit deterministic mappings. |

## Compatibility Invariant
`A recruiter inspecting a student profile sees the same capability–evidence relationships that the student dashboard implies, with no additional transformation layer.`
