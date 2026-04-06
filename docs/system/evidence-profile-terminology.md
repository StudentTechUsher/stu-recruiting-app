# Evidence Profile Terminology

## Terminology Authority
This document is the naming authority for product and architecture specs in Stu Recruiting.

All user-facing and product-level docs should use the canonical terms in this document unless a lower-level API or schema constraint requires legacy field naming.

When a conflict appears between this document and an older spec, this document is the source of truth and the older spec must add a replacement note.

## Canonical Terms
| Canonical term | Definition | Scope |
| --- | --- | --- |
| Evidence Profile | Candidate-owned, canonical representation of artifacts, claims, signals, and verified evidence. | Product language, UX, cross-team specs |
| Candidate capability profile | Persistent, versioned snapshot derived from evidence and used for role-conditioned fit projection. | System contracts, fit computation, explainability |
| Capability ontology | Stable axis vocabulary and normalization rules shared by candidate snapshots and role models. | System contracts, scoring and compatibility |
| Role capability model | Company-role-specific target model used for candidate alignment. Not a generic role template. | Product language, capability contracts |
| Capability Selection Agent | AI agent that helps candidate narrow to 1 to 2 role capability models based on evidence and preferences. | Agent and UX specs |
| Capability Fit Coaching | AI coaching flow that maps evidence gaps to concrete actions and expected evidence. | Agent and UX specs |
| Alignment score | Weighted rollup fit score in `0..1`, paired with confidence and evidence summaries. | System and UX fit surfaces |
| Open Profile Visibility to Selected Employers | Candidate-authorized action that opens one selected target package for curated employer-side review. | Workflow and recruiter handoff specs |
| Decision-Ready Candidate Package | Curated package for one selected company-role target containing evidence-backed strengths, gaps, and context for recruiter decision readiness. | Recruiter workflow and API specs |

## Term Mapping
| Context | Preferred term | Internal term | Definition | API or schema naming |
| --- | --- | --- | --- | --- |
| Candidate and recruiter product language | Evidence Profile | N/A | Candidate-owned evidence layer representing strengths, gaps, and supporting proof. | N/A |
| Candidate target model language | Role capability model | capability model or role mapping | Company-role-specific target model with stable ID. | `capability_model_*` fields remain valid until migration |
| Candidate computed fit state | Candidate capability profile | candidate snapshot | Versioned evidence-derived capability vector for role comparison. | `candidate_capability_profile_*` naming |
| Shared axis vocabulary | Capability ontology | capability taxonomy | Stable axis IDs and normalization constraints. | `ontology_version`, `axis_id` |
| Internal data model | N/A | artifact | Atomic evidence record with typed payload, provenance, and verification metadata. | `artifact_*` fields remain valid |
| Internal data collection | N/A | artifact set | Collection of artifacts linked to one candidate profile. | `artifacts` table |
| Recruiter decision package | Decision-Ready Candidate Package | recruiter review payload | Visibility-authorized package for one selected target. | Existing recruiter payload fields remain valid |

## Evidence Profile Definition
| Attribute | Rule |
| --- | --- |
| Ownership | Candidate-owned after claim; candidate is canonical owner of identity and profile representation. |
| Record role | System of record for candidate artifacts and normalized evidence. |
| Verification role | Surface for artifact trust state and verification tier context. |
| Cross-employer boundary | Employer-specific raw source payloads are isolated and never exposed across employers. |
| Decision policy | Evidence supports guidance and recruiter review. It must not produce ranking, scoring, or auto-filtering outcomes. |

> **Invariant:** After claim, a candidate has exactly one canonical Evidence Profile.

## Candidate Capability Profile Definition
| Attribute | Rule |
| --- | --- |
| Scope | Candidate-owned computed snapshot over ontology axes. |
| Ownership | System-derived from candidate evidence; candidate owns source evidence inputs. |
| Record role | Canonical computation artifact for multi-role projection and fit evaluation. |
| Update pattern | Versioned immutable snapshots with stale/fresh lifecycle. |
| Decision policy | Supports explainable guidance only, not ranking or automated hiring decisions. |

## Role Capability Model Definition
| Attribute | Rule |
| --- | --- |
| Scope | Exactly one company plus one role target. |
| Ownership | Defined by recruiting-side or system curation, selected by candidate. |
| Record role | Target capability expectations used for selection and coaching. |
| Selection constraint | Candidate may keep no more than two active role targets at a time. |
| Decision policy | Supports guidance and evidence planning only, not automated hiring decisions. |

## Boundary: Evidence Profile vs Candidate Capability Profile vs Role Capability Model
| Item | Evidence Profile | Candidate capability profile | Role capability model |
| --- | --- | --- | --- |
| Primary question | What evidence does the candidate currently have | What does the evidence-derived capability state look like | What capability levels are expected for this role |
| Ownership | Candidate-owned canonical profile | System-computed snapshot tied to candidate evidence | Company-role target definition |
| Update pattern | Continuous as artifacts are added, verified, or revised | Versioned immutable snapshots on input/version changes | Versioned target model updates |
| Primary consumer | Candidate, recruiter, operators | Fit and explainability pipelines | Candidate, coaching agent, recruiter context |
| Output role | Current evidence state | Computed candidate axis scores plus confidence | Target required levels and axis importance |

## Deprecated Aliases and Replacements
| Deprecated alias | Replacement | Status |
| --- | --- | --- |
| Capability Profile | Role capability model | Deprecated in docs. Keep legacy field names only where needed. |
| Role-only target model | Role capability model | Deprecated. Use company-role-specific language. |
| Capability Coach or Hiring Fit Coaching | Capability Fit Coaching | Deprecated. Use canonical coaching term. |
| Visibility opt-in to target employers | Open Profile Visibility to Selected Employers | Deprecated. Use controlled action label. |
| Candidate readiness score | Evidence-backed readiness summary | Deprecated for user copy; use explainable fit and confidence language. |

## Naming Rules
| If | Then |
| --- | --- |
| Content is user-facing or product-facing | Use canonical terms from this document. |
| Content is implementation-facing and tied to existing schema fields | Keep artifact and capability-model field names, then clarify user-facing mapping. |
| A document uses legacy terms | Add a deprecation note and link to this terminology spec. |
| A document defines new fit behavior | Use Candidate capability profile, Capability ontology, and Role capability model consistently. |

## Explicit Non-Goals
| Topic | Rule |
| --- | --- |
| Immediate schema rename | Terminology update does not require immediate database/API field rename. |
| Ranking semantics | Terminology standardization must not introduce ranking, scoring, or filtering behavior. |
| Employability guarantees | Terms must not imply guaranteed hiring outcomes. |

## Source of Truth References
- `docs/system/phase-1-product-model.md`
- `docs/system/capability-ontology.md`
- `docs/system/capability-model.md`
- `docs/system/candidate-capability-profile.md`
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/features/candidate-workflow-ux-spec.md`
