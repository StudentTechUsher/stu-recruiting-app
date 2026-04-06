# Phase 1 Product Model (No Scoring or Ranking)

## System Boundary
| Dimension | Phase 1 Rule |
| --- | --- |
| ATS position | Stu operates behind ATS platforms through integrations and curated handoff workflows. |
| Decision role | Stu does not score, rank, or automatically filter candidates. |
| Core function | Stu builds candidate Evidence Profiles, aligns them to selected role capability models, and supports evidence-backed recruiter readiness. |
| Output intent | Candidate guidance plus recruiter decision readiness through curated package review. |

> **Invariant:** Phase 1 is an evidence and trust system, not an automated hiring decision system.

## Canonical Profile Model
> **Invariant:** After claim, each candidate has exactly one canonical Evidence Profile.

> **Rule:** All post-claim ingestion, merging, and updates must target this canonical profile. Employer-scoped profile variants must not exist after claim.

> **Ownership transition:**
- Pre-claim: employer-scoped profile variants
- Post-claim: candidate-owned canonical Evidence Profile

## Inputs
| Input class | Sources | Example payload scope | Ownership at ingest |
| --- | --- | --- | --- |
| ATS candidate and application data | Greenhouse, Lever, BambooHR (and equivalent) | Candidate identity fields, job and application metadata, pipeline stage, attachments | Employer-scoped before claim |
| Transcript evidence | Transcript PDF plus parse outputs | Coursework and transcript-derived artifacts | Candidate evidence layer |
| External profile links | GitHub, LinkedIn, Kaggle, LeetCode | Public profile metadata and source evidence | Candidate evidence layer with provenance |
| Candidate-entered supporting files | Syllabus and supporting artifacts | Manual evidence attachments and verification support files | Candidate evidence layer |
| Candidate preferences and goals | Onboarding and profile preferences | Interest areas, work attributes, constraints, motivations | Candidate-owned preference context |
| Role capability model library | Company-role capability definitions | `capability_profile_id` (legacy field name), capability requirements, evidence expectations | Recruiter or operator curated |

## Processing Stages
| Stage | Description | Required output |
| --- | --- | --- |
| Onboarding | Candidate establishes baseline identity, profile, and preferences. | Candidate baseline context |
| Evidence ingestion and extraction | System captures source inputs and creates artifact candidates. | Raw source records plus structured drafts |
| Normalization and verification assignment | System normalizes artifact shape and assigns verification state and tier. | Normalized artifacts with trust metadata |
| Evidence Profile update | System merges records into canonical profile with deterministic merge rules. | Updated canonical profile plus provenance history |
| Capability selection | Candidate uses Capability Selection Agent to choose at most 2 active role targets. | Active target set and rationale |
| Capability Fit Coaching loop | Coaching maps evidence strengths and gaps to concrete actions and expected evidence. | Structured coaching recommendations |
| Evidence improvement | Candidate adds, revises, or verifies artifacts based on coaching guidance. | Improved profile evidence and verification state |
| Controlled visibility action | Candidate runs Open Profile Visibility to Selected Employers for one selected target. | Visibility request plus candidate-approved package |
| Operator and recruiter handoff | Internal workflow delivers Decision-Ready Candidate Package for curated review. | Recruiter-ready package payload |

> **Invariant:** Evidence Profile updates must never create additional profile variants after claim.

> **Invariant:** Artifacts are never deleted. All versions remain provenance-linked records.

## End-to-End Workflow (Candidate and Recruiter Linked Outcomes)
`ONBOARDING_COMPLETE -> EVIDENCE_PROFILE_ACTIVE -> CAPABILITY_SELECTION_IN_PROGRESS -> ACTIVE_CAPABILITY_PROFILES_SET(1..2) -> CAPABILITY_FIT_COACHING_ACTIVE -> EVIDENCE_IMPROVEMENT_ITERATION -> OPEN_PROFILE_VISIBILITY_REQUESTED -> OPERATOR_HANDOFF_READY -> DECISION_READY_CANDIDATE_PACKAGE_DELIVERED`

## Focused Targeting Rules
| Rule ID | Rule |
| --- | --- |
| PM-FOCUS-001 | Candidate may keep no more than 2 active role targets at one time. |
| PM-FOCUS-002 | Candidate may run Open Profile Visibility to Selected Employers only for one selected active target per request. |
| PM-FOCUS-003 | Workflow prioritizes depth of evidence for selected targets over broad application broadcasting. |
| PM-FOCUS-004 | Candidate guidance must explain target tradeoffs and encourage commitment to focused targets. |

## Output Contracts
| Output | Description | Consumer |
| --- | --- | --- |
| Evidence Profile | Candidate-owned profile with artifacts, provenance, verification metadata, and capability linkage context. | Candidate UX, recruiter review |
| Candidate capability profile | Versioned evidence-derived capability snapshot reusable across multiple role evaluations without per-role recomputation. | Fit, coaching, dashboard, recruiter context |
| Capability alignment summary | Evidence-backed strengths, gaps, and next actions per selected role target model. | Candidate coaching UX |
| Decision-Ready Candidate Package | Curated package for one selected company-role target, including evidence-backed strengths and gaps. | Operators and recruiters |
| Visibility request record | Candidate-authorized handoff request for a selected target. | Internal workflow and audit logs |

## Deterministic Behavior Requirements
| Requirement | Rule |
| --- | --- |
| Ordering | Recruiter list ordering remains deterministic (for example ATS stage and application time), not inferred candidate quality. |
| Merge behavior | Artifact selection follows verification strength, then completeness, then recency. |
| Identity resolution | All ingestion converges to one canonical profile post-claim. |
| Target constraints | Active target count and state transitions are enforced deterministically. |

## Explicit Exclusions
| Exclusion | Rule |
| --- | --- |
| Candidate scoring | No numeric candidate score is generated in Phase 1. |
| Candidate ranking | No ordered ranking list is generated in Phase 1. |
| Automated filtering | No auto-accept, auto-reject, or auto-hold decisions are made by Stu. |
| Visibility blast workflows | No mass-broadcast visibility to employers. Visibility is controlled and target-specific. |
| Opaque guidance framing | User-facing outputs must not rely on opaque score-centric framing. |

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/system/canonical-profile.md`
- `docs/system/capability-model.md`
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/features/recruiter-review-experience.md`
