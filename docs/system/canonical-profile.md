# Canonical Profile Contract

## Purpose
Define the shared identity and ownership contract for candidate profiles used by both student and recruiter Phase 1 experiences.

## Entity Ownership
| Entity | Owner | Scope | Notes |
| --- | --- | --- | --- |
| Employer-scoped profile variant (pre-claim) | Employer | Employer-only | Exists only before claim reconciliation completes. |
| Canonical Evidence Profile (post-claim) | Candidate | Cross-application | Exactly one canonical profile per candidate after claim. |
| Artifact version record | Candidate (post-claim), provenance attributed | Provenance-linked | Source context is retained as metadata. |
| Application linkage record | System-managed | Per application | Connects `application_id` to canonical `candidate_id` and provenance refs. |

## Core Invariants
| Invariant ID | Rule |
| --- | --- |
| CP-001 | After claim, each candidate has exactly one canonical Evidence Profile. |
| CP-002 | Post-claim ingestion must not create employer-scoped profile variants. |
| CP-003 | Candidate identity ownership is authoritative in reconciliation conflicts. |
| CP-004 | Cross-employer raw source payloads are never exposed. |
| CP-005 | Claim and reconciliation operations are deterministic and idempotent. |

## Claim State Transition
| From | Trigger | To | Required result |
| --- | --- | --- | --- |
| `UNCLAIMED` | Claim requested | `CLAIM_REQUESTED` | Claim intent recorded, no ownership mutation yet. |
| `CLAIM_REQUESTED` | Identity/auth validated | `CLAIM_VALIDATED` | Candidate identity confirmed. |
| `CLAIM_VALIDATED` | Reconciliation starts | `CANONICAL_RECONCILING` | Canonical target selected/created. |
| `CANONICAL_RECONCILING` | Merge + relink succeeds | `CLAIMED_CANONICAL_ACTIVE` | Single canonical profile active. |
| `CANONICAL_RECONCILING` | Partial failure | `CANONICAL_RECONCILING` | Retry-safe continuation without duplicate canonical creation. |

Text diagram:
`UNCLAIMED -> CLAIM_REQUESTED -> CLAIM_VALIDATED -> CANONICAL_RECONCILING -> CLAIMED_CANONICAL_ACTIVE`

## Application Linkage Contract
| Field | Requirement |
| --- | --- |
| `application_id` | Required. Unique ATS application identifier. |
| `candidate_id` | Required post-claim canonical candidate ID. Nullable only while unresolved pre-claim. |
| `employer_id` | Required. Source employer identifier. |
| `role_context` | Required. ATS role/job/stage context payload. |
| `artifact_snapshot_ids` | Optional. Point-in-time evidence snapshot IDs. |
| `source_provenance_refs` | Optional. Source lineage references when snapshot IDs are not used. |

## Visibility Rules
| Data class | Employer visibility |
| --- | --- |
| Canonical profile artifacts + normalized evidence | Visible to employers with linked applications. |
| Raw source payload from another employer | Not visible. |
| Raw source payload from same employer context | Visible only to that employer. |

## Anti-Regression Rules
| Rule ID | Rule |
| --- | --- |
| CP-AR-001 | Engineers must not reintroduce per-employer profile forks after claim. |
| CP-AR-002 | Claim retries must not create additional canonical profiles. |
| CP-AR-003 | New applications for claimed candidates always resolve to canonical profile linkage. |
