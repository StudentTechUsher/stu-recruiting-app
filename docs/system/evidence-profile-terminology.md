# Evidence Profile Terminology

## Terminology Authority
This document is the naming authority for product and architecture specs in Stu Recruiting.

All user-facing and product-level docs should use the canonical terms in this document unless a lower-level API or schema constraint requires legacy field naming.

When a conflict appears between this document and an older spec, this document is the source of truth and the older spec must add a replacement note.

## Canonical Terms
| Canonical term | Definition | Scope |
| --- | --- | --- |
| Evidence Profile | Candidate-owned, canonical representation of artifacts, claims, signals, and verified evidence. | Product language, UX, cross-team specs |
| Capability Profile | Company-role-specific capability model used as a target for candidate alignment. Not a generic role template. | Product language, capability contracts |
| Capability Selection Agent | AI agent that helps candidate narrow to 1 to 2 Capability Profiles based on evidence and preferences. | Agent and UX specs |
| Capability Fit Coaching | AI coaching flow that maps evidence gaps to concrete actions and expected evidence. | Agent and UX specs |
| Open Profile Visibility to Selected Employers | Candidate-authorized action that opens one selected target package for curated employer-side review. | Workflow and recruiter handoff specs |
| Decision-Ready Candidate Package | Curated package for one selected company-role target containing evidence-backed strengths, gaps, and context for recruiter decision readiness. | Recruiter workflow and API specs |

## Term Mapping
| Context | Preferred term | Internal term | Definition | API or schema naming |
| --- | --- | --- | --- | --- |
| Candidate and recruiter product language | Evidence Profile | N/A | Candidate-owned evidence layer representing strengths, gaps, and supporting proof. | N/A |
| Candidate target model language | Capability Profile | capability model or role mapping | Company-role-specific target model with stable ID. | `capability_model_*` fields remain valid until migration |
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

## Capability Profile Definition
| Attribute | Rule |
| --- | --- |
| Scope | Exactly one company plus one role target. |
| Ownership | Defined by recruiting-side or system curation, selected by candidate. |
| Record role | Target capability expectations used for selection and coaching. |
| Selection constraint | Candidate may keep no more than two active Capability Profiles at a time. |
| Decision policy | Supports guidance and evidence planning only, not automated hiring decisions. |

## Boundary: Evidence Profile vs Capability Profile
| Item | Evidence Profile | Capability Profile |
| --- | --- | --- |
| Primary question | What evidence does the candidate currently have | What evidence and capability shape does this company-role target require |
| Ownership | Candidate-owned canonical profile | Company-role target definition |
| Update pattern | Continuous as artifacts are added, verified, or revised | Versioned target model updates |
| Primary consumer | Candidate, recruiter, operators | Candidate, coaching agent, recruiter context |
| Output role | Current evidence state | Target expectation state |

## Deprecated Aliases and Replacements
| Deprecated alias | Replacement | Status |
| --- | --- | --- |
| Role-only target model | Capability Profile | Deprecated. Use company-role-specific language. |
| Capability Coach or Hiring Fit Coaching | Capability Fit Coaching | Deprecated. Use canonical coaching term. |
| Visibility opt-in to target employers | Open Profile Visibility to Selected Employers | Deprecated. Use controlled action label. |
| Candidate readiness score | Evidence-backed readiness summary | Deprecated. Do not use score-centric language in user copy. |

## Naming Rules
| If | Then |
| --- | --- |
| Content is user-facing or product-facing | Use canonical terms from this document. |
| Content is implementation-facing and tied to existing schema fields | Keep artifact and capability-model field names, then clarify user-facing mapping. |
| A document uses legacy terms | Add a deprecation note and link to this terminology spec. |
| A document defines new agent behavior | Use Capability Selection Agent and Capability Fit Coaching exactly. |

## Explicit Non-Goals
| Topic | Rule |
| --- | --- |
| Immediate schema rename | This terminology update does not require immediate database or API field rename. |
| Ranking semantics | Terminology standardization must not introduce ranking, scoring, or filtering behavior. |
| Employability guarantees | Terms must not imply guaranteed hiring outcomes. |

## Source of Truth References
- `docs/system/phase-1-product-model.md`
- `docs/system/capability-model.md`
- `docs/system/capability-derivation.md`
- `docs/system/evidence-model.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/features/candidate-workflow-ux-spec.md`
