# Student Claim Flow Specification (Callback-Only)

## Purpose
Define callback-only profile claiming with explicit trust boundaries and deterministic canonical binding.

## Entry Model
| Entry type | Requirement |
| --- | --- |
| Invite link | Includes claim intent token/hints sufficient for server-side claim binding. |
| Auth path | Uses normal student authentication flow and callback handling. |

## Trust Boundary Contract
| Step | Boundary rule |
| --- | --- |
| Invite token processing | Token validates claim intent only. |
| Auth callback | Callback validates authenticated identity. |
| Claim execution | Server binds identity to a single canonical profile. |
| Client behavior | Client does not decide candidate binding outcome. |

## Callback Claim Decision Table
| Condition | Behavior |
| --- | --- |
| Valid token + valid auth identity + identity already bound to same canonical profile | Return idempotent success; do not duplicate mutation. |
| Valid token + valid auth identity + identity resolves to a different claimed canonical profile | Reject claim and write conflict audit record. |
| Valid token + valid auth identity + resolvable unclaimed candidate | Execute canonical claim bind. |
| Valid token + transient reconciliation failure | Mark retryable state and retry safely. |
| Invalid or expired token, or failed auth identity validation | Reject with no claim mutation. |

## Idempotency and Replay Safety
| Rule ID | Rule |
| --- | --- |
| SCF-001 | Repeated callback execution with same claim intent must resolve to the same canonical profile. |
| SCF-002 | Replayed callback requests must not create duplicate canonical candidates or variants. |
| SCF-003 | Partial failure retries must continue reconciliation without creating forks. |

## State Transition
`INVITE_RECEIVED -> AUTHENTICATED -> CLAIM_VALIDATED -> CANONICAL_BINDING -> CLAIM_ACTIVE`

## Failure and Retry Rules
| Failure point | Required behavior |
| --- | --- |
| Token validation fails | Abort claim, keep existing state, surface explicit error. |
| Auth validation fails | Abort claim, no ownership mutation. |
| Reconciliation partially fails | Preserve provenance-safe writes and retry idempotently. |
| Application relink incomplete | Keep retry marker until all links converge to canonical profile. |

## Invariants
| Invariant ID | Rule |
| --- | --- |
| SCF-INV-001 | Claim flow always ends with one canonical profile for a claimed candidate. |
| SCF-INV-002 | No post-claim employer-scoped profile variants are created. |
| SCF-INV-003 | Claim retries are safe and deterministic. |
