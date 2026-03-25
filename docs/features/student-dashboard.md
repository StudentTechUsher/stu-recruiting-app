# Student Dashboard (Capability Dashboard) Specification

## Purpose
Define Phase 1 student landing behavior and CTA loops that strengthen the same evidence signals recruiters inspect.

## Route and Placement
| Rule | Requirement |
| --- | --- |
| Landing route | Authenticated student default route is `/student/dashboard`. |
| Primary intent | Show capability signal and trust state derived from evidence. |
| No dead-end | Dashboard must provide direct CTAs into evidence actions. |

## Dashboard Sections
| Section | Required content |
| --- | --- |
| Radar chart | Soft-skill baseline + union of role-required capabilities (deduped). |
| KPI strip | Capability coverage, verified evidence share, pending/unverified share, last updated timestamp. |
| Supporting stat | Optional `evidence_count`, displayed as secondary context only. |
| Action rail | CTAs for add artifacts, verify artifacts, review Evidence Profile. |

## Radar Contract
| Field | Requirement |
| --- | --- |
| `capability_id` | Required stable ID from capability model. |
| `label` | Required axis label. |
| `axis_type` | Required (`soft_skill` or `role_required`). |
| `covered` | Required boolean derived from evidence linkage presence. |
| `supporting_evidence_ids` | Required traceability list. |
| `verification_breakdown` | Required trust counts for linked evidence. |

## KPI Definitions
| KPI | Definition |
| --- | --- |
| Capability coverage | `covered_capabilities / total_axes` (displayed as percent). |
| Verified evidence share | `verified_linked_evidence / total_linked_evidence`. |
| Pending/unverified share | `(pending + unverified)_linked_evidence / total_linked_evidence`. |
| Last updated | Most recent `updated_at` across linked evidence records. |

## CTA Decision Table
| Condition | Primary CTA emphasis | Secondary CTA |
| --- | --- | --- |
| No evidence (`coverage = 0`, trust = 0) | Add artifacts | Review Evidence Profile |
| Partial coverage, no verification (`coverage > 0`, verified share = 0) | Verify artifacts | Add artifacts |
| Full coverage, low trust (one or more required capabilities with no verified evidence) | Verify high-impact artifacts | Review Evidence Profile |

## Deterministic Low-Data States
| State | Expected values | Required behavior |
| --- | --- | --- |
| `no_evidence` | coverage `0%`, trust `0`, empty radar values | Show empty-but-visible radar + Add artifacts emphasis. |
| `partial_no_verification` | coverage `>0`, verified share `0` | Show Verify artifacts emphasis. |
| `full_low_trust` | coverage `100%`, at least one required capability has no verified evidence | Show Verify high-impact artifacts emphasis. |

## Explicit Constraints
| Constraint | Rule |
| --- | --- |
| Ranking/scoring | Dashboard must not emit candidate score, rank, or hidden prioritization index. |
| Language guard | Dashboard copy must not imply ranking, match quality, or candidate scoring. |
| Opaque transforms | Every displayed value must be traceable to linked evidence IDs. |
| Compatibility | Capability-evidence relationships must match recruiter-visible relationships exactly. |
