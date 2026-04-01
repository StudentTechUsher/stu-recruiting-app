# Capability Fit Coaching Agent Specification

## Purpose
Define Capability Fit Coaching behavior that converts Evidence Profile and Capability Profile gaps into concrete, evidence-oriented next actions.

## User Problem
Candidates can see they are not yet decision-ready for a selected target but may not know which evidence gaps matter most or what to do next.

## MVP and Future-State Scope
| Scope | Definition |
| --- | --- |
| MVP | Generate structured strengths, gaps, recommended actions, and expected evidence for one selected Capability Profile at a time. |
| Future state | Multi-target planning, adaptive sequencing, and richer verification-path optimization. |

## Inputs
| Input | Required | Notes |
| --- | --- | --- |
| Evidence Profile snapshot | Yes | Artifacts, provenance, verification state and tier |
| Selected Capability Profile | Yes | `capability_profile_id` and target capability expectations |
| Candidate preferences and constraints | Yes | Time, resource, and work-style constraints |
| Prior coaching history | Optional | Previous action completion and evidence outcomes |

## Outputs
| Output | Requirement |
| --- | --- |
| Strength areas | Capabilities with credible current support |
| Gap areas | Capabilities lacking sufficient or trustworthy evidence |
| Recommended actions | Concrete actions candidate can execute next |
| Expected evidence | Artifacts expected if action is completed |
| Optional verification suggestions | Verification pathways that would improve credibility |

## Output Shape Contract
```json
{
  "strength_areas": [
    {
      "capability_id": "string",
      "summary": "string",
      "supporting_evidence_ids": ["string"],
      "confidence": "strong|moderate"
    }
  ],
  "gap_areas": [
    {
      "capability_id": "string",
      "gap_type": "missing|weak|unverifiable",
      "summary": "string",
      "missing_evidence_types": ["string"]
    }
  ],
  "recommended_actions": [
    {
      "action_id": "string",
      "priority": "high|medium|low",
      "description": "string",
      "target_capability_ids": ["string"],
      "estimated_effort": "string"
    }
  ],
  "expected_evidence": [
    {
      "action_id": "string",
      "artifact_type": "string",
      "artifact_description": "string",
      "verification_target": "self_asserted|platform_backed|verified"
    }
  ],
  "optional_verification_suggestions": [
    {
      "artifact_or_action_id": "string",
      "suggestion": "string",
      "impact_note": "string"
    }
  ]
}
```

## Required Data Contracts
| Contract | Requirement |
| --- | --- |
| Evidence model contract | Must provide verification state, verification tier, and evidence confidence context |
| Capability model contract | Must provide selected target capabilities and expected evidence hints |
| Derivation contract | Must provide traceable evidence links per capability |

## Guidance Generation Rules
| Rule ID | Rule |
| --- | --- |
| CFC-001 | Start with currently evidenced strengths to anchor candidate confidence in real proof. |
| CFC-002 | Identify gaps by missing, weak, or unverifiable evidence classes. |
| CFC-003 | Convert each high-priority gap into one or more executable actions. |
| CFC-004 | Map each action to expected evidence artifact outputs and verification targets. |
| CFC-005 | Tailor recommendations to candidate constraints without diluting evidence credibility goals. |

## Mapping Rules
| Mapping | Requirement |
| --- | --- |
| Gap to action | Action must directly reduce one or more identified capability gaps. |
| Action to expected evidence | Expected evidence must be specific, typed, and plausibly produce stronger credibility signals. |
| Expected evidence to verification | Suggest realistic verification path when available, otherwise label uncertainty. |

## Strengths vs Gaps Handling
| Requirement | Rule |
| --- | --- |
| Strength framing | Use evidence-backed language and cite supporting artifacts. |
| Gap framing | Clearly mark missing, weak, or unverifiable states and explain why they matter for target profile. |
| Balance | Present strengths and gaps together to avoid purely deficit-based experience. |

## Weak and Unverifiable Evidence Handling
| Rule ID | Rule |
| --- | --- |
| CFC-WEAK-001 | Weak evidence can inform suggestions but must be labeled as uncertain support. |
| CFC-WEAK-002 | Unverifiable evidence must trigger optional verification suggestions where feasible. |
| CFC-WEAK-003 | Decision-ready framing must prioritize verified and platform-backed evidence over self-asserted only evidence. |

## UX Surfaces and Interaction Model
| Surface | Requirement |
| --- | --- |
| Coaching summary card | Show top strengths, top gaps, and immediate next action |
| Gap detail panel | Show gap evidence basis and suggested actions |
| Action tracker | Candidate can mark actions started or completed and link resulting artifacts |
| Evidence expectation panel | Show expected evidence artifact shape and verification target |

## Runtime, Streaming, and Timeout Constraints (Free Tier Assumption)
| Constraint | Requirement |
| --- | --- |
| Streaming requirement | Synchronous coaching responses stream incremental structured sections. |
| Early stream start | Emit first stream event quickly after request acceptance. |
| Runtime budget | Agent turn completes within configured Vercel free-tier function max duration. |
| Bounded orchestration | Longer workflows must be staged into resumable phases rather than one blocking call. |
| Partial-result behavior | If budget risk appears, stream available strengths and initial actions, then return continuation path. |
| Timeout fallback | Return retryable state and preserved context token rather than hard failure. |
| Cancellation | User cancel must stop generation and preserve resumable progress when possible. |

## Guardrails and Trust
| Rule ID | Rule |
| --- | --- |
| CFC-SAFE-001 | Avoid guaranteed employability language. |
| CFC-SAFE-002 | Avoid opaque score-centric framing in user-facing outputs. |
| CFC-SAFE-003 | Use explainable evidence references for every recommendation. |
| CFC-SAFE-004 | Do not expose raw internal reasoning traces in streaming output. |

## Logging and Observability
| Event | Required fields |
| --- | --- |
| `capability_fit_coaching.started` | request_id, candidate_id, capability_profile_id |
| `capability_fit_coaching.partial_streamed` | request_id, section_name, elapsed_ms |
| `capability_fit_coaching.completed` | request_id, action_count, gap_count, elapsed_ms |
| `capability_fit_coaching.failed` | request_id, error_code, retryable, elapsed_ms |

## Success Metrics
| Metric | Target intent |
| --- | --- |
| Action adoption | Candidates execute recommended actions at useful rates |
| Evidence improvement | Suggested actions produce new or improved evidence artifacts |
| Trust clarity | Candidates understand weak versus strong evidence distinctions |
| Runtime reliability | Coaching responses complete within runtime budget with robust fallback behavior |

## Cross-References
- `docs/system/evidence-model.md`
- `docs/system/capability-derivation.md`
- `docs/features/candidate-workflow-ux-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
