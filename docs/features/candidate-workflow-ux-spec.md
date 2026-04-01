# Candidate Workflow UX Specification

## Purpose
Define responsive UX requirements for onboarding, evidence review, capability selection, coaching, and visibility authorization.

This spec provides concrete product design and frontend implementation guidance for desktop and mobile, with Storybook and accessibility expectations.

## Responsive Information Architecture
| Layer | Desktop behavior | Mobile behavior |
| --- | --- | --- |
| Primary nav | Persistent left rail with grouped workflow sections | Top bar plus compact bottom nav for core sections |
| Workflow context | Side-by-side context and detail regions where possible | Single-column progressive disclosure |
| Target context | Persistent active-target chip rail | Sticky compact target selector |

## Required Primary Screens
| Screen | Core purpose | Required primary actions |
| --- | --- | --- |
| Onboarding | Capture baseline identity, preferences, and source intent | Continue onboarding, connect first source |
| Evidence Profile review | Inspect and manage artifacts, trust state, and provenance | Add evidence, verify evidence, resolve weak evidence |
| Capability Profile selection | Choose focused 1 to 2 active targets | Compare targets, commit selection, replace active target |
| Capability Fit Coaching | Review strengths, gaps, and actionable recommendations | Start action, link resulting evidence, request refresh |
| Profile visibility authorization | Confirm target-specific visibility request | Confirm consent, submit request, review status |

## Screen-by-Screen Interaction Requirements
### Onboarding
- Use stepper pattern with 5 to 7 concise steps.
- Show progress indicator and save-safe resume behavior.
- Surface source-connect actions with clear optionality and expected benefit.

### Evidence Profile Review
- Use card plus detail pattern with filters by source, capability, trust, and target.
- Show verification state and verification tier badges on every artifact card.
- Show weak-evidence callouts with direct improvement actions.

### Capability Profile Selection
- Use comparison list with up to 4 candidate targets at once on desktop.
- On mobile, use stacked cards with expandable comparison rows.
- Enforce max-2 active target rule in UI with explicit replace flow.

### Capability Fit Coaching
- Use sectioned output: strengths, gaps, recommended actions, expected evidence.
- Show action-to-evidence linkage inline.
- Support action checklist with completion state and evidence attach shortcut.

### Profile Visibility Authorization
- Present single target summary, package preview, and explicit consent text.
- Require confirmation checkbox plus submit action.
- Show submission status timeline with operator handoff stage.

## Mobile-Specific Interaction Patterns
| Pattern | Requirement |
| --- | --- |
| Navigation | Keep primary workflow actions reachable within one thumb range. |
| Layout density | Prefer one-card-per-row and progressive disclosure for detail content. |
| Compare interactions | Use segmented toggle for target A or target B rather than dense side-by-side tables. |
| Input ergonomics | Use larger touch targets and short inline forms. |

## Desktop-Specific Interaction Patterns
| Pattern | Requirement |
| --- | --- |
| Comparison affordance | Allow side-by-side target comparison panels for two active targets. |
| Context persistence | Keep evidence list visible while viewing detail and coaching context. |
| Action density | Support compact action table with expected evidence and verification target columns. |

## Component Pattern Requirements
| Pattern | Requirement |
| --- | --- |
| Card | Must support title, trust badges, target context chip, and quick actions. |
| List | Must support filtering, sorting by deterministic non-ranking fields, and empty-state fallback. |
| Detail panel | Must preserve source context and provide provenance links. |
| Stepper | Must expose current step, completion states, and resumable progress. |
| Agent chat panel | Must render structured sections, status updates, and action artifacts without raw reasoning traces. |

## Empty States
| Context | Required copy behavior |
| --- | --- |
| No evidence | Explain missing evidence and provide first-add action. |
| No active target | Explain focus model and route to selection flow. |
| No coaching history | Offer first coaching session action and describe expected output sections. |
| No visibility requests | Explain controlled visibility workflow and prerequisites. |

## Loading and Long-Running AI States
| State | Requirement |
| --- | --- |
| Initial loading | Show skeletons that match final layout structure. |
| Streaming in progress | Show section-level progress placeholders and partial content as it arrives. |
| Partial-result completion | Render completed sections while pending sections continue streaming or queue for continuation. |
| Timeout fallback | Show recoverable message with retry or continue action and preserved context. |
| Cancellation | Allow cancel action and reflect stopped state without losing prior completed sections. |

## Agent Runtime and Streaming UX Constraints (Free Tier Assumption)
| Constraint | Requirement |
| --- | --- |
| Streaming-first UX | Synchronous agent interactions must render streamed partial results. |
| Early feedback | UI must show immediate status after request submission and first stream event quickly. |
| Runtime-aware behavior | UX should assume bounded server runtime and support continuation for larger tasks. |
| Non-monolithic flows | Multi-step agent work should appear as bounded stages in UI. |
| Timeout resilience | On timeout, keep completed sections and offer explicit resume or retry path. |
| Reasoning privacy | Do not render raw internal reasoning traces. Render productized status, rationale summaries, and evidence references only. |

## Trust Cues and Explainability UI
| Requirement | Rule |
| --- | --- |
| Trust badges | Show both verification state and verification tier. |
| Evidence references | Every guidance claim links to evidence IDs or explicit no-evidence marker. |
| Language | Use strengths, gaps, and next actions language. Avoid ranking and score-centric framing. |
| Uncertainty cues | Explicitly label weak or unverifiable evidence and suggest improvement paths. |

## Accessibility Expectations
| Area | Requirement |
| --- | --- |
| Semantic structure | Use heading hierarchy and landmark regions per screen. |
| Keyboard support | All primary actions and list-detail interactions are keyboard accessible. |
| Focus management | Preserve focus on panel transitions and streaming updates. |
| Color and contrast | Trust badges and status indicators meet contrast requirements. |
| Live updates | Streaming updates announced via accessible live regions without noisy repetition. |

## Storybook Coverage Requirements
| Component or pattern | Required stories |
| --- | --- |
| Evidence cards and lists | default, weak-evidence, verified, empty, loading |
| Capability selection comparison | one-target recommendation, two-target recommendation, replace-target flow |
| Coaching output sections | strengths-only partial, full output, timeout fallback, retry state |
| Visibility authorization flow | ready, missing prereq, submitted, operator-pending |
| Responsive layouts | desktop and mobile variants for each primary screen |

## Tokens, Spacing, and Layout Guidance
| Category | Guidance |
| --- | --- |
| Spacing scale | Use consistent 4px baseline scale for spacing decisions. |
| Container widths | Use constrained readable widths for narrative content and wider grids for evidence comparison. |
| Breakpoints | Define and document mobile, tablet, and desktop breakpoints in component stories. |
| Status color tokens | Separate informational, caution, and trust states using named tokens. |

## Agent UX Do and Do Not
| Do | Do not |
| --- | --- |
| Show structured partial progress and next available actions | Show raw internal reasoning trace output |
| Explain recommendations with evidence references | Claim guaranteed outcomes |
| Preserve completed sections on retries | Reset full coaching output on recoverable timeout |
| Offer explicit continue flows for bounded phases | Force one long synchronous blocking run |

## Cross-References
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/candidate-targeting-visibility-workflow-spec.md`
- `docs/system/evidence-profile-terminology.md`
