# LeetCode Source Integration Specification

## Purpose
Define how LeetCode source data should be imported, normalized, verified, and interpreted in Stu Recruiting without overstating what challenge-platform data proves.

## Scope and Uncertainty Statement
LeetCode integration in Phase 1 assumes direct API reliability and field availability may vary.

The MVP must support uncertainty-aware ingestion paths using public profile links and candidate-provided evidence artifacts when required.

## MVP and Future-State Model
| Scope | Definition |
| --- | --- |
| MVP | Link LeetCode profile as source pointer, ingest available public profile and activity fields, derive conservative artifacts, assign explicit verification tier and uncertainty flags. |
| Future state | Add richer platform integrations, stronger validation paths, and deeper contest or problem-level provenance where available and reliable. |

## Data Layer Separation
| Layer | Definition | Examples |
| --- | --- | --- |
| Raw source data | Untransformed source capture from LeetCode profile or candidate-provided export evidence. | handle, profile URL, solved counts, difficulty distribution, activity fields |
| Derived artifacts | Normalized evidence records generated from raw source data. | algorithmic problem-solving artifact, contest participation artifact |
| Verified signals | Derived artifacts promoted through accepted verification paths. | validated contest result, independently corroborated achievement |

## Profile Presence Semantics
| Item | Rule |
| --- | --- |
| LeetCode profile link | Treated as source pointer and provenance anchor, not standalone proof of readiness. |
| Profile connection event | Recorded as source-integrity signal only. |
| Profile-only state | Must trigger recommendation to add broader evidence categories. |

## Candidate Data Elements (When Available)
| Category | Potential fields | MVP expectation |
| --- | --- | --- |
| Profile-level | handle, profile URL, public summary | Import if available |
| Solved problems | counts by total and difficulty | Import if available and label with source timestamp |
| Problem metadata | topics and tags | Import where available, else mark unknown |
| Contest participation | contests joined, ranking snapshots, percentile snapshots | Import when available, default conservative trust state |
| Activity signals | streak indicators and recent activity | Import with uncertainty flag and non-claims limitations |
| Candidate-provided evidence | screenshot or export file references | Ingest as supporting source artifacts with weaker default trust |

## Derived Artifact Mapping (MVP)
| Derived artifact type | Source basis | Default verification state | Default verification tier |
| --- | --- | --- | --- |
| `project` (algorithmic practice evidence) | solved-problem and difficulty metadata | `unverified` | `platform_backed` |
| `competition` (contest participation) | contest fields and ranking snapshots | `unverified` | `platform_backed` |
| `test` (if relevant challenge performance snapshot) | candidate-provided score-like evidence | `unverified` | `self_asserted` unless platform-backed source exists |

## Verification Tier Guidance
| Tier | LeetCode applicability | Notes |
| --- | --- | --- |
| `self_asserted` | Candidate-entered claims or uploads without strong provenance | Lowest trust posture |
| `platform_backed` | Public profile or source metadata capture with provenance | Useful but still limited |
| `verified` | Additional independent validation path completes | Not guaranteed in MVP |

## Interpretation Limits and Non-Claims Policy
| Policy ID | Rule |
| --- | --- |
| LC-NC-001 | LeetCode evidence represents algorithmic problem-solving evidence only. |
| LC-NC-002 | LeetCode evidence is not a universal proxy for full hiring readiness. |
| LC-NC-003 | Do not infer communication, collaboration, or role execution capability solely from LeetCode data. |
| LC-NC-004 | Do not imply guaranteed employability or interview outcomes from LeetCode presence or metrics. |

## Influence Boundaries in Capability Evidence
| Rule ID | Rule |
| --- | --- |
| LC-INF-001 | LeetCode-derived evidence may support technical depth-related capabilities where relevant. |
| LC-INF-002 | LeetCode-derived evidence must be balanced with non-platform evidence categories for decision-ready packaging. |
| LC-INF-003 | Coaching may reference LeetCode signals as one input, but must map to broader evidence-building actions. |

## Failure Modes and Fallbacks
| Failure mode | Behavior |
| --- | --- |
| Direct profile data unavailable | Store profile URL and candidate-provided evidence as source pointer path |
| Partial field availability | Persist known fields and mark unknown fields explicitly |
| Stale source snapshot | Prompt refresh action and mark snapshot recency |
| Provenance ambiguity | Downgrade trust tier to `self_asserted` until resolved |

## Future-State Extensions
- Add stronger source connectors with explicit API contracts when reliability is confirmed.
- Add richer problem-level provenance and topic coverage lineage.
- Add verification partnerships or cross-source corroboration paths.

## Cross-References
- `docs/system/evidence-model.md`
- `docs/system/artifact-verification-model.md`
- `docs/artifact-verification-methods.md`
- `docs/features/student-artifact-ingestion.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
