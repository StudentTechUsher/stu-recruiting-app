# Phase 1 Recruiter Compatibility Specification

## Purpose
Define recruiter-side compatibility expectations that student Phase 1 outputs must satisfy.

## Recruiter Inputs Required From Shared Contracts
| Recruiter requirement | Required shared contract |
| --- | --- |
| Candidate list with capability summary and evidence indicators | Canonical profile + capability derivation + verification model |
| Capability-to-evidence inspection | Evidence model + capability model |
| Canonical identity and post-claim linkage | Canonical profile contract |
| Trust labeling without decisioning | Verification model |

## Recruiter Compatibility Invariants
| Invariant ID | Rule |
| --- | --- |
| RPC-001 | Recruiter views consume canonical candidate identity after claim. |
| RPC-002 | Recruiter evidence views use normalized artifacts with provenance metadata. |
| RPC-003 | Recruiter trust indicators reflect verification state only. |
| RPC-004 | Recruiter flow does not use ranking/scoring/filtering in Phase 1. |
| RPC-005 | Cross-employer raw source payloads remain isolated. |

## Student-to-Recruiter Integrity Rules
| Rule ID | Rule |
| --- | --- |
| RPC-INT-001 | Capability IDs shown on student dashboard must match recruiter capability IDs for the same evidence linkage. |
| RPC-INT-002 | Evidence linkage counts and verification breakdowns must match across student and recruiter surfaces for the same profile state. |
| RPC-INT-003 | No recruiter-only hidden transformation layer may change capability-evidence semantics. |

## Acceptance Criteria
| Criteria ID | Criteria |
| --- | --- |
| RPC-AC-001 | Recruiter inspection of a claimed student profile shows the same capability-evidence relationships implied by student dashboard. |
| RPC-AC-002 | Provenance-linked artifact versions remain available for recruiter audit/explainability where allowed. |
| RPC-AC-003 | Verification changes trust labels only and does not alter candidate inclusion/order logic. |
