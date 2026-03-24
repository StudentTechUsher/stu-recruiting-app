# Identity and Ownership Model

## Entity Ownership Model
| Entity | Primary owner | Scope | Notes |
| --- | --- | --- | --- |
| Employer-scoped pre-claim profile variant | Employer | Employer-only pre-claim context | Exists to preserve source context before claim reconciliation. |
| Canonical Evidence Profile | Candidate | Cross-application candidate view | Single canonical profile after claim. |
| Artifact version record | Candidate (post-claim) with source attribution | Provenance-linked | Candidate owns canonical representation; source ownership is retained as provenance metadata. |
| Application linkage record | System-managed | Per application | Stores candidate/employer association and provenance references. |

---

## 3.1 Candidate Matching Decision Table
| Condition | Match result | Required action |
| --- | --- | --- |
| Incoming candidate email matches normalized email of an existing profile | `MATCH_FOUND` | Evaluate ownership and claim state using profile creation logic. |
| Incoming candidate email does not match any existing profile | `NO_MATCH_FOUND` | Create new employer-scoped profile variant with `CLAIMED = FALSE`. |

---

## 3.2 Profile Creation Logic
| Existing state | Condition | Action | Result |
| --- | --- | --- | --- |
| No existing profile | N/A | Create profile variant | `CLAIMED = FALSE`, employer-scoped |
| Existing canonical candidate profile | `CLAIMED = TRUE` | Link application to canonical profile | No new employer profile variant |
| Existing unclaimed profile | `CLAIMED = FALSE` and same employer | Reuse existing unclaimed variant | No duplicate variant |
| Existing unclaimed profile | `CLAIMED = FALSE` and different employer | Create employer-specific unclaimed variant | Separate ownership boundary preserved |

---

## 3.3 Employer Context Separation
| Rule | Decision |
| --- | --- |
| Duplicate profiles for same email | Allowed only pre-claim when ownership contexts differ by employer. |
| Raw source data sharing pre-claim | Prohibited across employers. |
| Cross-employer artifact merging pre-claim | Prohibited. |
| Purpose of separation | Preserve employer data ownership and source confidentiality until claim reconciliation. |

---

## 3.4 Claim Flow Ownership Transition

### CLAIMED State Definitions
| State | Meaning |
| --- | --- |
| `CLAIMED = FALSE` | Unclaimed employer-scoped profile variant. |
| `CLAIMED = TRUE` | Candidate-owned canonical Evidence Profile. |

### CLAIMED State Transition Table
| From | Trigger | To | Required outcome |
| --- | --- | --- | --- |
| `CLAIMED = FALSE` | Candidate successfully claims identity | `CLAIMED = TRUE` | Single canonical profile is established. |
| `CLAIMED = TRUE` | New ATS application received | `CLAIMED = TRUE` | Application links to canonical profile; no employer variant created. |

### Claim Transition (Text Diagram)
`UNCLAIMED_EMPLOYER_PROFILE(S) -> CLAIM_REQUESTED -> CLAIM_VALIDATED -> CANONICAL_PROFILE_CREATED_OR_SELECTED -> ARTIFACT_RECONCILED -> CLAIMED_CANONICAL_ACTIVE`

### Post-Claim Visibility Rules
| Data class | Employer visibility rule |
| --- | --- |
| Canonical Evidence Profile (candidate-owned artifacts + normalized evidence) | Visible to employers associated through applications. |
| Raw employer-specific source payload from other employers | Not visible across employer boundaries. |
| Employer's own raw source payload | Visible only to that employer. |

---

## 3.5 Profile Merge / Reconciliation

### Merge Preconditions
| Condition | Required behavior |
| --- | --- |
| Multiple profiles share same normalized email at claim | Merge into one canonical candidate profile. |
| Candidate-owned profile already exists | Use existing candidate profile as canonical target. |
| Candidate-owned profile does not exist | Create canonical candidate profile and merge into it. |

### Artifact Conflict Resolution Rules
| Priority order | Rule |
| --- | --- |
| 1 | Candidate wins on ownership and identity fields. |
| 2 | Highest verification strength wins canonical artifact representation. |
| 3 | If verification strength ties, select most complete artifact representation. |
| 4 | If completeness ties, select most recent artifact (`updated_at`). |
| Always | Preserve all versions as provenance-linked records; no artifact deletion is allowed. |

### Verification Strength Order (for merge selection)
`verified > pending > unverified`

### Duplicate Artifact Handling
| Scenario | Canonical representation | Historical handling |
| --- | --- | --- |
| Duplicate artifact versions across employer variants | Select by conflict rules above | Retain all versions with provenance links |
| Same verification and completeness | Most recent version becomes canonical | Older versions remain queryable |

---

## Canonical Lifecycle Anti-Regression Rules
| Rule ID | Invariant |
| --- | --- |
| ID-001 | After claim, candidate has exactly one canonical Evidence Profile. |
| ID-002 | Post-claim ingestion must not create employer-scoped profile variants. |
| ID-003 | All new evidence merges into canonical profile with provenance preserved. |
| ID-004 | Engineers must not reintroduce per-employer profile forks for claimed candidates. |
| ID-005 | Artifacts are never deleted; all versions must remain provenance-linked. |
| ID-006 | Verification state affects artifact representation only and must not affect ownership. |

---

## Application Linkage Record Contract
| Field | Type/shape | Requirement |
| --- | --- | --- |
| `application_id` | External ATS application identifier | Required |
| `candidate_id` | Canonical candidate identifier | Required |
| `employer_id` | Employer/company identifier | Required |
| `artifact_snapshot_ids` | Array of artifact snapshot IDs | Required when snapshotting canonical evidence for the application |
| `source_provenance_refs` | Array/object of provenance references | Required when preserving source lineage without snapshots |