# Verification Model Contract

## Purpose
Define shared verification states and propagation rules for evidence trust in Phase 1.

## Source Reference
- Baseline method definitions: `docs/artifact-verification-methods.md`.

## Verification States
| State | Meaning | Strength order |
| --- | --- | --- |
| `verified` | Accepted verification path completed. | 3 |
| `pending` | Verification submitted/in progress. | 2 |
| `unverified` | No accepted verification completion path yet. | 1 |

## Assignment Rules (If/Then)
| If | Then |
| --- | --- |
| Transcript parse/extraction succeeds with valid payload | Assign `verified` with transcript method metadata. |
| GitHub/Kaggle extraction passes source checks | Assign `verified` with source extraction metadata. |
| Manual coursework includes syllabus awaiting validation | Assign `pending` with `syllabus_upload`. |
| Resume/LinkedIn extraction has no independent verifier | Assign `unverified`. |
| Planned verifier path completes | Promote to `verified` and retain prior provenance state history. |

## Propagation Rules
| Rule ID | Rule |
| --- | --- |
| VER-PROP-001 | Verification state is stored at artifact/evidence record level. |
| VER-PROP-002 | Verification state propagates to capability linkage trust metrics (counts/shares by state). |
| VER-PROP-003 | Verification propagation must not alter capability existence/coverage membership. |
| VER-PROP-004 | Verification influences trust labels only, not ranking/filtering. |

## Trust-Layer UI Rules
| State | Student UI | Recruiter UI |
| --- | --- | --- |
| `verified` | High-trust label | High-trust label |
| `pending` | In-review label | In-review label |
| `unverified` | Needs verification label | Low-trust label |

## Invariants
| Invariant ID | Rule |
| --- | --- |
| VER-001 | Verification is a trust layer, not a decisioning layer. |
| VER-002 | Verification must not change candidate ordering, ranking, inclusion, or exclusion. |
| VER-003 | All versions retain original verification metadata for auditability. |
