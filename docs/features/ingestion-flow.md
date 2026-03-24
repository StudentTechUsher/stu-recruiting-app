# Ingestion Flow Specification (ATS + Evidence Inputs)

## Purpose
Define how Stu ingests ATS and external evidence data, links identity, and updates canonical Evidence Profiles without scoring, ranking, or filtering.

---

## Input Channels
| Channel | Input examples | Ownership context at ingest |
| --- | --- | --- |
| ATS integrations | Candidate/application identity, stage, attachments, job role | Employer-scoped before claim |
| Transcript intake | Transcript files and parse outputs | Candidate evidence layer |
| External links | GitHub, LinkedIn, Kaggle profile evidence | Candidate evidence layer |
| Supporting files | Syllabus and artifact support documents | Candidate evidence layer |

---

## Identity Linking Decision Table
| Condition | Action | Result |
| --- | --- | --- |
| Match to claimed canonical profile | Link directly to canonical profile | No employer variant creation |
| Match to unclaimed same-employer variant | Reuse same unclaimed variant | No duplicate variant |
| Match to unclaimed different-employer variant | Create employer-specific unclaimed variant (pre-claim only) | Ownership boundary preserved |
| No match | Create unclaimed profile variant | `CLAIMED = FALSE` |

> **Invariant:** After a profile is claimed, ingestion must never create additional profile variants. All identity resolution must converge to the canonical profile.

---

## Normalization and Merge Rules
| Rule ID | Rule |
| --- | --- |
| IF-001 | Normalize artifact shape, type, source, and verification metadata before persistence. |
| IF-002 | Merge duplicate artifact versions using canonical conflict rules: highest verification, then completeness, then recency. |
| IF-003 | Preserve all non-canonical versions as provenance-linked records; no artifact deletion is allowed. |
| IF-004 | After claim, all ingestion writes must target the canonical profile only. |
| IF-005 | Pre-claim merges occur only within the same employer-scoped variant; cross-employer merging is prohibited until claim. |

---

## Application Linkage Contract
| Field | Requirement |
| --- | --- |
| `application_id` | Required per ATS application |
| `candidate_id` | Required canonical candidate identifier after claim; may reference unclaimed variant pre-claim |
| `employer_id` | Required employer identifier |
| `artifact_snapshot_ids` | Optional; used when storing point-in-time artifact references |
| `source_provenance_refs` | Optional; used when storing lineage references |

> **Invariant:** After claim, all applications must resolve to the canonical `candidate_id`.

---

## Ingestion Pipeline States
| State | Description |
| --- | --- |
| `received` | Raw input accepted from ATS or external source |
| `identity_resolved` | Candidate identity matched or provisional profile created |
| `extracted` | Structured artifact candidates produced |
| `normalized` | Artifacts validated and normalized |
| `verified_state_assigned` | Verification status assigned per method |
| `merged` | Canonical artifact selected and provenance linked |
| `linked` | Application linkage record persisted |
| `completed` | End-to-end ingestion succeeded |
| `failed_retryable` | Recoverable failure; safe to retry idempotently |

---

## State Transition (Text Diagram)
`RECEIVED -> IDENTITY_RESOLVED -> EXTRACTED -> NORMALIZED -> VERIFIED_STATE_ASSIGNED -> MERGED -> LINKED -> COMPLETED`

---

## Explicit Exclusions
| Exclusion | Rule |
| --- | --- |
| Scoring | Ingestion must not compute candidate score. |
| Ranking | Ingestion must not assign candidate order position. |
| Filtering | Ingestion must not suppress candidates from recruiter visibility based on model output. |