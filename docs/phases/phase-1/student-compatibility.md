# Phase 1 Student Compatibility Specification

## Purpose
Define Phase 1 student constraints needed to stay compatible with shared canonical/evidence contracts and recruiter evidence review.

## Compatibility Mapping Matrix
| Student surface | Shared contract dependency | Compatibility requirement |
| --- | --- | --- |
| Capability Dashboard | Capability model + capability derivation + verification model | Displayed capability/trust signal must be derivable from linked evidence only. |
| Evidence Profile | Evidence model + verification model | Artifact versions and provenance remain queryable and consistent. |
| Claim flow | Canonical profile contract | Callback claim converges to one canonical profile deterministically. |
| Ingestion flow | Evidence model + verification model + capability derivation | Source extraction outputs normalize to recruiter-compatible evidence structures. |

## Student Phase 1 Invariants
| Invariant ID | Rule |
| --- | --- |
| SPC-001 | Student landing route is `/student/dashboard`. |
| SPC-002 | Student dashboard and recruiter review must reflect identical capability-evidence relationships. |
| SPC-003 | No student-only transform layer may alter recruiter-facing evidence meaning. |
| SPC-004 | No scoring, ranking, or proxy prioritization may be introduced. |
| SPC-005 | Verification is trust labeling only and does not change capability existence. |

## Internal Contracts
| Contract | Requirement |
| --- | --- |
| Student dashboard read contract | Exposes radar axes, coverage/trust KPIs, and traceable supporting evidence IDs. |
| Auth callback claim contract | Performs callback-only server claim bind using validated invite intent + auth identity. |
| Feature-flag route guard contract | Enforces flag-off behavior for deferred modules at navigation and direct-route levels. |

## Flag-Off Module Behavior
| Rule | Requirement |
| --- | --- |
| Navigation | Hide deferred modules from student nav when flag is off. |
| Direct URL access | Server-side route guard redirects to `/student/dashboard`. |
| Placeholder behavior | Do not render coming-soon page for flag-off modules. |

## Traceability Requirements
| Requirement | Rule |
| --- | --- |
| Radar traceability | Each radar axis references supporting evidence IDs. |
| KPI traceability | Coverage/trust KPIs map to deterministic linkage counts and verification states. |
| Auditability | Historical artifact versions remain provenance-linked and inspectable. |

## Low-Data Behavior Requirements
| State | Expected behavior |
| --- | --- |
| No evidence | Coverage/trust show zero state; CTA emphasis is Add artifacts. |
| Partial evidence with no verification | CTA emphasis is Verify artifacts. |
| Full coverage with low trust | CTA emphasis is Verify high-impact artifacts. |

## Required Compatibility Statement
`A recruiter inspecting a student profile sees the same capability–evidence relationships that the student dashboard implies, with no additional transformation layer.`

## Acceptance Criteria
| Criteria ID | Criteria |
| --- | --- |
| SPC-AC-001 | Capability derivation outputs are deterministic and non-scoring. |
| SPC-AC-002 | Dashboard axis values are explainable by linked evidence IDs. |
| SPC-AC-003 | Claim flow is callback-only, deterministic, idempotent, and retry-safe. |
| SPC-AC-004 | Student-produced evidence is recruiter-consumable without extra transform logic. |
| SPC-AC-005 | Feature-flag route guards hide deferred modules and redirect to dashboard. |
