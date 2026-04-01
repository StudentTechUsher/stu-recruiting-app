# Ingestion Flow Specification (ATS + Evidence Inputs)

## Purpose
Define how Stu ingests ATS and candidate evidence data, links identity, and updates canonical Evidence Profiles with Capability Profile-aware downstream outputs.

## Input Channels
| Channel | Input examples | Ownership context at ingest |
| --- | --- | --- |
| ATS integrations | Candidate identity, application stage, attachments, job context | Employer-scoped before claim |
| Transcript intake | Transcript files and parse outputs | Candidate evidence layer |
| External links | GitHub, LinkedIn, Kaggle, LeetCode profile evidence | Candidate evidence layer |
| Supporting files | Syllabus and artifact support documents | Candidate evidence layer |

## Identity Linking Decision Table
| Condition | Action | Result |
| --- | --- | --- |
| Match to claimed canonical profile | Link directly to canonical profile | No employer variant creation |
| Match to unclaimed same-employer variant | Reuse same unclaimed variant | No duplicate variant |
| Match to unclaimed different-employer variant | Create employer-specific unclaimed variant (pre-claim only) | Ownership boundary preserved |
| No match | Create unclaimed profile variant | `CLAIMED = FALSE` |

> **Invariant:** After claim, ingestion must never create additional profile variants. Identity resolution must converge to canonical profile.

## Normalization and Merge Rules
| Rule ID | Rule |
| --- | --- |
| IF-001 | Normalize artifact shape, type, source, verification state, and verification tier before persistence. |
| IF-002 | Merge duplicate artifact versions using canonical conflict rules: verification strength, then completeness, then recency. |
| IF-003 | Preserve all non-canonical versions as provenance-linked records. No artifact deletion is allowed. |
| IF-004 | After claim, all ingestion writes target canonical profile only. |
| IF-005 | Pre-claim merges occur only within same employer-scoped variant. Cross-employer merge is prohibited before claim. |
| IF-006 | LeetCode source records are ingested with uncertainty-aware tagging when platform access or metadata completeness is limited. |

## Capability-Profile-Aware Downstream Contract
| Field | Requirement |
| --- | --- |
| `capability_profile_context` | Optional at ingestion time, required when evidence is evaluated for selected targets. |
| `capability_profile_context.capability_profile_ids` | Selected target IDs currently active for candidate. |
| `capability_profile_context.evaluation_mode` | `baseline` when no active targets, else `targeted`. |
| `capability_profile_context.last_evaluated_at` | Timestamp for derivation coherence. |

## Application Linkage Contract
| Field | Requirement |
| --- | --- |
| `application_id` | Required per ATS application. |
| `candidate_id` | Required canonical candidate identifier after claim. |
| `employer_id` | Required employer identifier. |
| `artifact_snapshot_ids` | Optional point-in-time artifact references. |
| `source_provenance_refs` | Optional lineage references. |

> **Invariant:** After claim, all applications resolve to canonical `candidate_id`.

## Ingestion Pipeline States
| State | Description |
| --- | --- |
| `received` | Raw input accepted from ATS or source action |
| `identity_resolved` | Candidate identity matched or provisional profile created |
| `extracted` | Structured artifact candidates produced |
| `normalized` | Artifacts validated and normalized |
| `verification_assigned` | Verification state and tier assigned |
| `merged` | Canonical artifact selected and provenance linked |
| `linked` | Application linkage or profile linkage persisted |
| `completed` | End-to-end ingestion succeeded |
| `failed_retryable` | Recoverable failure, safe for idempotent retry |

State diagram:
`RECEIVED -> IDENTITY_RESOLVED -> EXTRACTED -> NORMALIZED -> VERIFICATION_ASSIGNED -> MERGED -> LINKED -> COMPLETED`

## LeetCode Uncertainty Handling
| Rule ID | Rule |
| --- | --- |
| IF-LC-001 | When direct data access is limited, ingest public profile links and candidate-provided exports as source pointers with explicit uncertainty flags. |
| IF-LC-002 | Mark LeetCode-derived evidence as `platform_backed` or `self_asserted` until stronger verification exists. |
| IF-LC-003 | Do not map LeetCode signals to broad readiness claims without supporting evidence categories. |

## Explicit Exclusions
| Exclusion | Rule |
| --- | --- |
| Scoring | Ingestion must not compute candidate score. |
| Ranking | Ingestion must not assign candidate rank position. |
| Filtering | Ingestion must not suppress candidate visibility based on model output. |

## Cross-References
- `docs/system/evidence-model.md`
- `docs/system/capability-derivation.md`
- `docs/system/leetcode-source-integration-spec.md`
- `docs/features/student-artifact-ingestion.md`
