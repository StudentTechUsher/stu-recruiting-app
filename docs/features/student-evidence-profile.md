# Student Evidence Profile Specification

## Purpose
Define how students inspect and manage evidence while preserving recruiter-compatible artifact structures.

## Route
| Route | Requirement |
| --- | --- |
| `/student/artifacts` | Primary Evidence Profile workspace in Phase 1. |

## Required Views
| View | Requirement |
| --- | --- |
| Evidence list | Show normalized artifacts with verification labels and provenance context. |
| Evidence detail | Show artifact metadata, source, supporting files, and linked capabilities. |
| Version/provenance view | Show provenance-linked versions where applicable. |

## Supported Operations
| Operation | Requirement |
| --- | --- |
| Add artifact | Create typed artifact with normalized `artifact_data`. |
| Replace artifact source | Create a new version and move `active_version_id` to the new version. |
| Remove artifact from primary display | Clear active pointer or mark inactive; preserve all provenance-linked versions and evidence links. |
| Re-extract | Create a new version even if source is unchanged, unless dedupe proves equivalence. |
| Verification tracking | Display current verification state and method metadata. |

## Verification Display Rules
| Verification state | Student UI behavior |
| --- | --- |
| `verified` | Show high-trust label. |
| `pending` | Show in-review label. |
| `unverified` | Show needs-verification label. |

## Cross-Link Rules
| Source | Destination | Requirement |
| --- | --- | --- |
| Dashboard KPI/CTA | Evidence Profile list/detail | Must deep-link directly to relevant evidence workflow. |
| Capability axis detail | Evidence list filtered by capability | Must preserve traceability via supporting evidence IDs. |

## Explicit Constraints
| Constraint | Rule |
| --- | --- |
| Data loss | Evidence operations must not silently delete provenance-linked history. |
| Divergence | Student-visible evidence relations must remain compatible with recruiter evidence views. |
| Ranking/scoring | Evidence profile must not show rank/score fields. |
