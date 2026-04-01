# Capability Selection Agent Specification

## Purpose
Define the Capability Selection Agent that helps candidates select a focused set of 1 to 2 Capability Profiles based on evidence, interests, and practical tradeoffs.

## User Problem
Candidates often start with broad role interest and fragmented evidence.

Without guidance, target selection becomes unfocused and evidence-building effort gets spread too thin across too many company-role targets.

## MVP and Future-State Scope
| Scope | Definition |
| --- | --- |
| MVP | Agent compares a bounded candidate target set and guides candidate to commit to at most 2 active Capability Profiles. |
| Future state | Agent supports richer longitudinal target planning, seasonal market context, and multi-session strategy memory. |

## Inputs
| Input | Required | Notes |
| --- | --- | --- |
| Evidence Profile snapshot | Yes | Artifact set, verification state, verification tier, capability linkage summaries |
| Candidate preferences | Yes | Interests, motivations, preferred work attributes, constraints |
| Candidate goals | Yes | Near-term role direction, timeline, location or domain preferences where available |
| Available Capability Profiles | Yes | Bounded set of candidate-relevant company-role targets |
| Current active targets | Yes | Enforce max-2 constraint |

## Outputs
| Output | Requirement |
| --- | --- |
| Recommended targets | One or two capability profiles with rationale |
| Deprioritized targets | Candidate-relevant alternatives with explicit reasons |
| Tradeoff summary | Explicit gain and loss statements for candidate decision |
| Commit action | Structured action for candidate to confirm target set |

## Output Shape Contract
```json
{
  "recommended_targets": [
    {
      "capability_profile_id": "string",
      "company": "string",
      "role": "string",
      "fit_summary": "string",
      "evidence_support": ["string"],
      "risk_notes": ["string"]
    }
  ],
  "rejected_or_deprioritized_targets": [
    {
      "capability_profile_id": "string",
      "reason": "string",
      "revisit_conditions": ["string"]
    }
  ],
  "tradeoffs": [
    {
      "comparison": "string",
      "advantage": "string",
      "cost": "string"
    }
  ],
  "rationale": {
    "candidate_goals_alignment": ["string"],
    "evidence_alignment": ["string"],
    "focus_reason": "string"
  },
  "commit_action": {
    "type": "set_active_capability_profiles",
    "proposed_active_profiles": ["string"],
    "max_allowed": 2
  },
  "confidence_language_constraints": {
    "allowed": [
      "evidence suggests",
      "current profile supports",
      "likely stronger path"
    ],
    "prohibited": [
      "guaranteed hire",
      "certain offer",
      "automatic fit"
    ]
  }
}
```

## Orchestration and System Context
| Component | Role |
| --- | --- |
| Capability Selection Agent | Produces recommendation and commitment proposal |
| Capability profile service | Provides bounded comparison set and profile metadata |
| Evidence model service | Provides evidence and trust summaries |
| Profile service | Persists selected `active_capability_profiles` |
| UX layer | Renders recommendations and captures candidate commitment |

## Product-Level Reasoning Boundaries
| Boundary | Requirement |
| --- | --- |
| Comparison set size | Compare a bounded set of relevant targets, not full market search feed behavior |
| Recommendation framing | Explain strengths, gaps, and tradeoffs, not ranking claims |
| Outcome promises | Never imply guaranteed employability or interview outcomes |
| Evidence grounding | Every recommendation must reference evidence or explicit no-evidence context |

## Decision Rules for Narrowing to 1 to 2 Targets
| Rule ID | Rule |
| --- | --- |
| CSA-DEC-001 | Recommend exactly 1 target when evidence is concentrated around one profile and second target would dilute near-term progress. |
| CSA-DEC-002 | Recommend 2 targets when evidence overlap is high and both remain credible within candidate constraints. |
| CSA-DEC-003 | Reject additional targets beyond 2 and provide explicit replacement rule. |
| CSA-DEC-004 | Prioritize targets where candidate can produce stronger evidence within declared timeline and constraints. |
| CSA-DEC-005 | If evidence is insufficient across all candidates, recommend one exploratory target plus evidence-building plan before expansion. |

## Explanation UX Requirements
| Requirement | Rule |
| --- | --- |
| Recommendation cards | Show profile target, why selected, evidence basis, risk notes |
| Tradeoff section | Show what candidate gives up when focusing each target |
| Commitment step | Explicit confirm action before changing active targets |
| Replacement guidance | When already at 2 active targets, require archive or replace flow |

## Failure Modes and Recovery
| Failure mode | Behavior |
| --- | --- |
| Insufficient evidence context | Return constrained recommendation with explicit evidence gaps and next-evidence prompts |
| Capability profile data unavailable | Show retryable fallback state and keep current active targets unchanged |
| Conflicting preference inputs | Ask candidate to resolve conflict with structured prompt in UI |
| Runtime budget risk | Stream partial recommendation sections and return resumable continuation token |

## Runtime, Streaming, and Timeout Constraints (Free Tier Assumption)
| Constraint | Requirement |
| --- | --- |
| Streaming requirement | Response must stream incremental structured output for synchronous interactions. |
| Early stream start | First event should emit quickly after request acceptance to keep connection active. |
| Runtime budget | Agent turn must complete comfortably within configured Vercel free-tier max duration. |
| Long workflow handling | Multi-step analysis must run as bounded phases with resumable state rather than one monolithic run. |
| Timeout fallback | On time budget risk, return partial results plus retry or continue instructions. |
| Cancellation | Client cancellation must stop active generation and preserve resumable state when possible. |

## Logging and Observability
| Event | Required fields |
| --- | --- |
| `capability_selection.started` | request_id, candidate_id, active_target_count, profile_count_considered |
| `capability_selection.partial_streamed` | request_id, section_name, elapsed_ms |
| `capability_selection.completed` | request_id, recommended_count, commit_ready, elapsed_ms |
| `capability_selection.failed` | request_id, error_code, retryable, elapsed_ms |

## Safety and Trust Considerations
| Rule ID | Rule |
| --- | --- |
| CSA-SAFE-001 | Do not produce employability guarantees or deterministic hiring claims. |
| CSA-SAFE-002 | Keep recommendation language evidence-first and non-ranking. |
| CSA-SAFE-003 | Surface uncertainty explicitly when evidence is weak or unverifiable. |
| CSA-SAFE-004 | Avoid exposing raw internal reasoning traces in user-facing streams. |

## Success Criteria
| Metric | Target intent |
| --- | --- |
| Focus adoption rate | Candidates commit to 1 to 2 active targets rather than broad unfocused sets |
| Recommendation usefulness | Candidates report recommendation rationale as understandable and actionable |
| Evidence progression | Candidates add or verify evidence for selected targets within follow-up window |
| Workflow reliability | Selection responses complete within configured runtime budget with resilient fallback behavior |

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/system/capability-model.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/features/candidate-workflow-ux-spec.md`
