# Artifact Verification Methods

## Purpose
Define what candidate evidence paths can be treated as verified, pending, or unverified, and clarify limits for LeetCode-derived evidence in Phase 1.

## Verification States
- `verified`: artifact evidence passed an accepted verification path.
- `pending`: evidence was submitted but verification did not complete yet.
- `unverified`: extracted or user-entered artifact without accepted verification evidence.

## Verification Tiers
- `self_asserted`: candidate-entered or extracted without independent source validation.
- `platform_backed`: source platform data with provenance, but no full independent validation.
- `verified`: accepted verification path completed.

## Verification Methods Used in Artifact Data
- `transcript_parse` (`verified` tier)
- `transcript_extraction` (`verified` tier)
- `github_extraction` (`platform_backed` tier)
- `kaggle_extraction` (`platform_backed` tier)
- `leetcode_profile_extraction` (`platform_backed` tier)
- `leetcode_contest_capture` (`platform_backed` tier)
- `syllabus_upload` (`self_asserted` tier until validated)
- `resume_extraction` (`self_asserted` tier)
- `linkedin_extraction` (`self_asserted` tier)

## Verification Requirements by Artifact Type
| Artifact type | What candidate must do | Resulting status and tier |
| --- | --- | --- |
| `coursework` | Path A (live): upload transcript and run transcript parse with valid outputs. | `verified` and `verified` tier |
| `coursework` | Path B (target): submit coursework with syllabus and pass syllabus match validation. | `pending` then `verified`; tier upgrades to `verified` when validation completes |
| `project` | Connect GitHub and extract project evidence with stable source provenance. | Usually `verified` state with `platform_backed` tier per policy |
| `project` | Connect Kaggle and extract project evidence with source provenance. | Usually `verified` state with `platform_backed` tier per policy |
| `project` | Connect LeetCode profile and capture challenge-related artifacts. | Default `unverified` state with `platform_backed` tier until additional validation |
| `project` | Resume, LinkedIn, or manual entry without additional verifier path. | `unverified` state with `self_asserted` tier |
| `competition` | Capture LeetCode contest participation or ranking evidence from public profile. | Default `unverified` state with `platform_backed` tier until additional validation |
| `competition` | Provide official organizer evidence via reviewer or validator path. | `verified` state and `verified` tier after successful validation |
| `internship` | Provide official internship evidence and complete review flow. | Target `verified` and `verified` tier |
| `employment` | Provide official employment evidence and complete review flow. | Target `verified` and `verified` tier |
| `certification` | Provide credential evidence and issuer validation path. | Target `verified` and `verified` tier |
| `leadership` | Provide role evidence and organization validation path. | Target `verified` and `verified` tier |
| `club` | Provide membership evidence and roster validation path. | Target `verified` and `verified` tier |
| `research` | Provide research output evidence and publication validation path. | Target `verified` and `verified` tier |
| `test` | Provide official assessment report and provider validation path. | Target `verified` and `verified` tier |

## LeetCode-Specific Rules
| Rule ID | Rule |
| --- | --- |
| LC-VER-001 | LeetCode profile presence is a source pointer by itself, not sufficient standalone readiness proof. |
| LC-VER-002 | Solved-problem counts, streaks, and contest participation may inform algorithmic problem-solving evidence only. |
| LC-VER-003 | LeetCode-derived evidence must be labeled with explicit verification state and tier. |
| LC-VER-004 | LeetCode signals must be combined with broader evidence categories before decision-ready packaging. |

## Interpretation Limits and Non-Claims
| Policy ID | Rule |
| --- | --- |
| VM-LIMIT-001 | Do not claim LeetCode performance proves full job readiness. |
| VM-LIMIT-002 | Do not use LeetCode metrics as a universal proxy for candidate quality. |
| VM-LIMIT-003 | Do not imply employability guarantees from challenge-platform evidence. |
| VM-LIMIT-004 | User-facing guidance must emphasize strengths, gaps, and next evidence actions. |

## Current Implementation Notes
- Transcript, GitHub, and Kaggle extraction paths can produce high-trust evidence quickly when source checks pass.
- Resume and LinkedIn extraction paths are intentionally treated as weak evidence until stronger verification exists.
- LeetCode integration is introduced with explicit uncertainty handling and conservative interpretation in Phase 1.
- Candidate and recruiter surfaces must display verification state and tier consistently.

## Cross-References
- `docs/system/artifact-verification-model.md`
- `docs/system/leetcode-source-integration-spec.md`
- `docs/features/student-evidence-profile.md`
