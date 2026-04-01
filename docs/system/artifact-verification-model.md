# Artifact Verification Model

## Purpose
Define verification states, verification tiers, and trust-layer behavior for artifact evidence, including LeetCode-derived evidence and weak-evidence interpretation limits.

## Source of Truth
- Baseline verification methods: `docs/artifact-verification-methods.md`
- Terminology authority: `docs/system/evidence-profile-terminology.md`
- LeetCode source integration: `docs/system/leetcode-source-integration-spec.md`

## Verification States and Strength
| Verification state | Meaning | Merge strength |
| --- | --- | --- |
| `verified` | Artifact passed an accepted verification path. | 3 |
| `pending` | Verification evidence submitted but not yet completed. | 2 |
| `unverified` | No accepted verification completion evidence. | 1 |

> **Invariant:** Merge conflict resolution uses verification strength ordering `verified > pending > unverified`.

## Verification Tiers
| Verification tier | Meaning | Typical examples |
| --- | --- | --- |
| `self_asserted` | Candidate-entered or source-extracted without independent validation. | Manual entry, resume extraction, unvalidated screenshot claims |
| `platform_backed` | Evidence backed by source platform data and provenance but without full independent verification. | GitHub profile metadata, Kaggle profile metadata, LeetCode public profile metadata |
| `verified` | Evidence completed accepted verification path with stronger trust posture. | Transcript parse, validated official document, attestation workflow |

## Verification Method Matrix by Artifact Type
| Artifact type | Verification method | Classification | Default tier | Resulting state |
| --- | --- | --- | --- | --- |
| `coursework` | `transcript_parse` | live | `verified` | `verified` |
| `coursework` | `transcript_extraction` | live | `verified` | `verified` |
| `coursework` | `syllabus_upload` | pending | `self_asserted` | `pending` until validation |
| `coursework` | `syllabus_ai_match` | pending | `verified` | `verified` after validation |
| `project` | `github_extraction` | live | `platform_backed` | `verified` |
| `project` | `kaggle_extraction` | live | `platform_backed` | `verified` |
| `project` | `leetcode_profile_extraction` | mvp | `platform_backed` | `unverified` by default unless promoted by additional verification |
| `project` | `resume_extraction` | live | `self_asserted` | `unverified` |
| `project` | `linkedin_extraction` | live | `self_asserted` | `unverified` |
| `competition` | `leetcode_contest_capture` | mvp | `platform_backed` | `unverified` by default unless validated |
| `competition` | `competition_result_document_review` | planned | `verified` | `verified` after validation |
| `internship` | `internship_document_review` | planned | `verified` | `verified` after validation |
| `employment` | `employment_document_review` | planned | `verified` | `verified` after validation |
| `certification` | `issuer_registry_validation` | planned | `verified` | `verified` |
| `leadership` | `organization_roster_validation` | planned | `verified` | `verified` |
| `club` | `membership_roster_validation` | planned | `verified` | `verified` |
| `research` | `publication_or_doi_validation` | planned | `verified` | `verified` |
| `test` | `assessment_provider_validation` | planned | `verified` | `verified` |

## Assignment Rules (If and Then)
| If | Then |
| --- | --- |
| Source is transcript parse or extraction and payload passes validation | Set state `verified` and tier `verified`. |
| Source is GitHub or Kaggle extraction and payload passes source checks | Set tier `platform_backed`; state may be `verified` when extraction path is accepted by policy. |
| Source is LeetCode profile or contest capture with only public profile evidence | Set tier `platform_backed` and state `unverified` unless independent verifier completes. |
| Source is resume or LinkedIn extraction with no additional validation | Set state `unverified` and tier `self_asserted`. |
| Planned verifier path completes successfully | Promote state to `verified` and tier to `verified`, retaining prior provenance history. |

> **Invariant:** Verification is assigned per artifact version, not globally across all representations.

## Weak or Unverifiable Evidence Handling
| Rule ID | Rule |
| --- | --- |
| VER-WEAK-001 | Weak evidence remains visible and traceable with explicit trust labeling. |
| VER-WEAK-002 | Coaching may use weak evidence for exploratory suggestions but must call out uncertainty. |
| VER-WEAK-003 | Decision-Ready Candidate Package must distinguish `self_asserted` and `platform_backed` from `verified` evidence. |
| VER-WEAK-004 | Weak evidence must not be framed as proof of broad job readiness without supporting artifacts. |

## Interpretation Limits and Non-Claims Policy
| Policy ID | Rule |
| --- | --- |
| VER-LIMIT-001 | Algorithmic challenge evidence, including LeetCode, is one evidence category and not a universal proxy for hiring readiness. |
| VER-LIMIT-002 | Do not infer soft-skill readiness solely from coding challenge data. |
| VER-LIMIT-003 | Do not represent LeetCode presence as guaranteed interview performance or employability outcome. |
| VER-LIMIT-004 | User-facing copy must describe evidence context, strengths, and gaps without ranking language. |

## Trust-Layer Impact (No Ranking)
| Verification state | Candidate impact | Recruiter impact |
| --- | --- | --- |
| `verified` | Show high-trust indicator. | Show highest trust indicator. |
| `pending` | Show in-review indicator. | Show in-review indicator. |
| `unverified` | Show needs-verification indicator. | Show low-trust indicator. |

> **Invariant:** Verification influences trust display only, not candidate ordering, inclusion, or exclusion.

## Cross-System Invariants
| Invariant ID | Rule |
| --- | --- |
| VER-INV-001 | Verification strength determines representation precedence, not ownership precedence. |
| VER-INV-002 | Candidate ownership overrides employer ownership regardless of verification state. |
| VER-INV-003 | All artifact versions retain verification metadata and provenance for auditability. |
| VER-INV-004 | Verification and tier semantics must remain consistent across dashboard, coaching, and recruiter package views. |

## Cross-References
- `docs/artifact-verification-methods.md`
- `docs/system/evidence-model.md`
- `docs/system/leetcode-source-integration-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
