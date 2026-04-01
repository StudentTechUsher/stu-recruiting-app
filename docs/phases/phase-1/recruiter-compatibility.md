# Phase 1 Recruiter Compatibility Specification

## Purpose
Define recruiter-side compatibility expectations for evidence-backed review, including controlled intake of visibility-authorized Decision-Ready Candidate Packages.

## Recruiter Inputs Required From Shared Contracts
| Recruiter requirement | Required shared contract |
| --- | --- |
| Candidate list with capability and evidence trust summary | Canonical profile + derivation + verification model |
| Capability-to-evidence inspection | Evidence model + capability model |
| Visibility-authorized package intake | Candidate targeting and visibility workflow |
| Canonical identity and post-claim linkage | Canonical profile contract |

## Recruiter Compatibility Invariants
| Invariant ID | Rule |
| --- | --- |
| RPC-001 | Recruiter views consume canonical candidate identity after claim. |
| RPC-002 | Recruiter evidence views use normalized artifacts with provenance metadata. |
| RPC-003 | Trust indicators reflect verification state and tier only. |
| RPC-004 | Recruiter flow does not use ranking or automated filtering logic. |
| RPC-005 | Cross-employer raw source payloads remain isolated. |
| RPC-006 | Visibility-authorized package intake remains curated and operator-mediated. |

## Candidate-to-Recruiter Integrity Rules
| Rule ID | Rule |
| --- | --- |
| RPC-INT-001 | Candidate-facing and recruiter-facing capability IDs must match for same evidence linkage. |
| RPC-INT-002 | Evidence linkage counts and trust breakdowns must match across surfaces for same profile state. |
| RPC-INT-003 | No recruiter-only hidden transformation may alter capability-evidence semantics. |
| RPC-INT-004 | Decision-Ready Candidate Package must carry target-specific context (`capability_profile_id`, company, role). |

## Visibility Intake Compatibility Rules
| Rule ID | Rule |
| --- | --- |
| RPC-VIS-001 | Intake requires explicit candidate authorization via Open Profile Visibility to Selected Employers. |
| RPC-VIS-002 | Intake is one target per request and must include selected target metadata. |
| RPC-VIS-003 | Repeated requests for same target are policy-limited to reduce spam behavior. |
| RPC-VIS-004 | Intake payload must preserve evidence-backed strengths and gap context without ranking narrative. |

## Acceptance Criteria
| Criteria ID | Criteria |
| --- | --- |
| RPC-AC-001 | Recruiter inspection shows same evidence relationships implied in candidate-facing surfaces. |
| RPC-AC-002 | Provenance-linked artifact versions remain available for explainability where permitted. |
| RPC-AC-003 | Trust and verification changes do not alter inclusion or ordering logic. |
| RPC-AC-004 | Visibility-authorized package intake follows operator-mediated and target-specific workflow constraints. |

## Cross-References
- `docs/features/recruiter-review-experience.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `app/api/recruiter/README.md`
- `lib/recruiter/README.md`
