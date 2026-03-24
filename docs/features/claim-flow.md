# Claim Flow Specification

## Purpose
Define the deterministic transition from employer-scoped pre-claim records to a single canonical candidate-owned Evidence Profile.

## Preconditions
| Condition | Required |
| --- | --- |
| Candidate identity proof passed | Yes |
| At least one unclaimed profile variant exists or an existing canonical profile is resolvable | Yes |
| Candidate email normalization completed | Yes |

## Claim Workflow
| Step | Action | Output |
| --- | --- | --- |
| 1 | Resolve all profile variants by normalized candidate identity | Candidate profile set |
| 2 | Select an existing canonical candidate profile or create a new one | Canonical `candidate_id` |
| 3 | Reconcile artifacts using merge conflict rules | Canonical artifact representations |
| 4 | Preserve non-canonical versions as provenance-linked records | Provenance history retained |
| 5 | Relink all current applications to the canonical profile and ensure future applications resolve to it on ingest | Unified application association |
| 6 | Mark canonical ownership active (`CLAIMED = TRUE`) | Candidate-owned active state |

## Claim Decision Table
| Condition | Behavior |
| --- | --- |
| Claimed canonical profile already exists | Merge variants into the existing canonical profile |
| No claimed canonical profile exists | Create canonical profile, then merge variants |
| Duplicate artifacts detected | Select canonical representation by verification, then completeness, then recency |
| Merge conflict on identity ownership | Candidate-owned identity is authoritative |

## Post-Claim Visibility Rules
| Data class | Employer visibility |
| --- | --- |
| Canonical profile artifacts + normalized evidence | Visible |
| Raw source payload from another employer | Not visible |
| Raw source payload from the same employer context | Visible only to that employer |

## Post-Claim Lifecycle Rules
| Rule ID | Invariant |
| --- | --- |
| CF-001 | Candidate has exactly one canonical Evidence Profile after claim completion. |
| CF-002 | New ATS applications must not create employer-scoped profile variants after claim. |
| CF-003 | New evidence merges into canonical profile with provenance retained. |
| CF-004 | Per-employer profile fork logic is prohibited post-claim. |
| CF-005 | Artifacts are never deleted during merge; they are only superseded and retained as provenance-linked records. |

## State Transition (Text Diagram)
`UNCLAIMED -> CLAIM_REQUESTED -> CLAIM_VALIDATED -> CANONICAL_RECONCILING -> CLAIMED_CANONICAL_ACTIVE`

## Failure and Retry Rules
| Failure point | Behavior |
| --- | --- |
| Identity validation fails | Keep unclaimed state; do not mutate ownership. |
| Reconciliation partially fails | Keep provenance-safe partial writes, mark flow retryable, do not create forked canonical duplicates. |
| Application relink fails | Mark reconciliation pending, retry idempotently until all current applications point to the canonical profile. Future applications resolve to the canonical profile on ingest. |
