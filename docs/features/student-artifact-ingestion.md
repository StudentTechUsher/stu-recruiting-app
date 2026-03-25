# Student Artifact Ingestion Specification

## Purpose
Define Phase 1 ingestion touchpoints and processing requirements for student evidence inputs.

## Supported Sources
| Source | Input type | Required outcome |
| --- | --- | --- |
| Resume | Uploaded document | Extract and persist normalized artifact drafts with provenance. |
| Transcript | Uploaded document | Extract coursework/evidence with verification-aware metadata. |
| GitHub | Profile/repository metadata | Extract project evidence with source provenance. |
| Kaggle | Profile metadata | Extract project/competition/research evidence with provenance. |

## Ingestion Pipeline States
| State | Description |
| --- | --- |
| `received` | Input accepted from student source action. |
| `extracting` | Extraction in progress. |
| `extracted` | Structured artifact drafts produced. |
| `normalized` | Artifact schema normalized. |
| `verification_assigned` | Verification assigned during normalization when deterministic, or after explicit verification rule/action pass. |
| `persisted` | Artifacts and provenance saved. |
| `failed_retryable` | Recoverable failure with safe retry. |

State diagram:
`RECEIVED -> EXTRACTING -> EXTRACTED -> NORMALIZED -> VERIFICATION_ASSIGNED -> PERSISTED`

## Artifact Management Contract
| Operation | Requirement |
| --- | --- |
| Add | Persist normalized artifact and provenance refs. |
| Replace | Persist new version; retain prior provenance-linked versions. |
| Remove | Hide or deactivate primary display artifact while preserving provenance-linked history and downstream evidence references. |
| Re-extract | Run extraction again and persist as new provenance-linked version(s). |

## Normalization Rules
| Rule ID | Rule |
| --- | --- |
| SAI-001 | Normalize to allowed artifact types and required fields. |
| SAI-002 | Persist source provenance refs (`source`, `source_object_id`, `ingestion_run_id`, `file_refs`, timestamps, fingerprint/hash when available). |
| SAI-003 | Assign verification state per verification model rules. |
| SAI-004 | Ensure ingestion output is compatible with capability derivation contract. |
| SAI-005 | If equivalent source payload is re-ingested, detect equivalence and avoid duplicate canonical evidence unless content or provenance materially changed. |

## Verification Assignment Timing
| Condition | Behavior |
| --- | --- |
| Deterministic verification rule satisfied during normalization | Assign verification in the same ingestion run. |
| Deterministic verification rule not satisfied | Keep `pending` or `unverified` until explicit verification action/rule pass. |
| Explicit verification action/rule pass succeeds | Transition to `verification_assigned` with updated state metadata. |

## Verification Integration
| Requirement | Rule |
| --- | --- |
| Visibility | Student sees verification state and method/source context per artifact. |
| Propagation | Verification flows to capability trust metrics and dashboard KPIs. |
| Constraint | Verification does not alter capability existence mapping. |

## Phase 1 Constraints
| Constraint | Rule |
| --- | --- |
| No ranking/scoring | Ingestion must not emit ranking, scoring, or recommendation state. |
| Determinism | Same input and same evidence state must produce same normalized mapping outcome. |
| Compatibility | Persisted evidence structures must be recruiter-compatible without hidden transform layers. |

## Failure Safety and Retry
| Rule ID | Rule |
| --- | --- |
| SAI-FR-001 | Failures must not partially publish invalid artifacts as active evidence. |
| SAI-FR-002 | Retry resumes from a safe checkpoint or restarts idempotently. |
| SAI-FR-003 | Failed runs preserve audit trail via provenance and ingestion run metadata. |
