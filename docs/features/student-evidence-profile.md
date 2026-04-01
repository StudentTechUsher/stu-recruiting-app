# Student Evidence Profile Specification

## Purpose
Define how candidates inspect and manage evidence while preserving recruiter-compatible artifact structures and capability-target context.

## Route
| Route | Requirement |
| --- | --- |
| `/student/artifacts` | Primary Evidence Profile workspace in Phase 1. |

## Required Views
| View | Requirement |
| --- | --- |
| Evidence list | Show normalized artifacts with verification state, verification tier, and provenance context. |
| Evidence detail | Show artifact metadata, source, linked capabilities, and selected Capability Profile relevance. |
| Version and provenance view | Show provenance-linked versions where applicable. |
| Evidence quality summary | Show strong, moderate, limited, and insufficient evidence cues per selected target. |
| Coaching expectation panel | Show expected evidence tied to active coaching actions. |

## Supported Operations
| Operation | Requirement |
| --- | --- |
| Add artifact | Create typed artifact with normalized data and provenance. |
| Replace artifact source | Create new version and move active pointer as needed. |
| Remove artifact from primary display | Mark inactive while preserving historical versions and linkage references. |
| Re-extract | Create new version unless dedupe proves equivalence. |
| Verification tracking | Display current verification state, verification tier, and method metadata. |

## Evidence Quality Cues
| Cue | Trigger | Display behavior |
| --- | --- | --- |
| `strong_evidence` | Verified or platform-backed evidence with strong coverage support | Show high-confidence evidence cue and linked strengths summary. |
| `limited_evidence` | Mostly self-asserted or sparse support | Show caution cue and recommended verification actions. |
| `insufficient_evidence` | No meaningful support for target capability | Show explicit gap cue with add-evidence actions. |
| `conflicting_evidence` | Inconsistent versions or contradictory claims | Show conflict cue and recommend clarification workflow. |

## Weak and Unverifiable Evidence Rules
| Rule ID | Rule |
| --- | --- |
| SEP-WEAK-001 | Weak evidence remains visible and editable with explicit trust labeling. |
| SEP-WEAK-002 | Weak evidence cannot be labeled as decision-ready support until improved or verified. |
| SEP-WEAK-003 | Candidate receives concrete next actions for improving weak evidence credibility. |

## Coaching-Linked Evidence Expectations
| Requirement | Rule |
| --- | --- |
| Action traceability | Each coaching recommendation may include expected evidence artifact and verification target. |
| Progress linkage | Evidence updates must show whether they address a known target capability gap. |
| Profile context | Expectation views are scoped to selected Capability Profile context. |

## Cross-Link Rules
| Source | Destination | Requirement |
| --- | --- | --- |
| Dashboard CTA | Evidence Profile list or detail | Deep-link directly into relevant evidence workflow. |
| Capability selection summary | Evidence list filtered by selected target | Preserve traceability through linked evidence IDs. |
| Coaching recommendation | Evidence add or edit flow | Pre-fill expected artifact context when possible. |

## Explicit Constraints
| Constraint | Rule |
| --- | --- |
| Data loss | Evidence operations must never silently delete provenance-linked history. |
| Divergence | Candidate and recruiter evidence relations remain compatible. |
| Ranking | Evidence Profile must not display ranking outputs or score-centric claims. |

## Cross-References
- `docs/system/evidence-model.md`
- `docs/features/student-dashboard.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
