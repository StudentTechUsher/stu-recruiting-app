# Candidate Targeting and Visibility Workflow Specification

## Purpose
Define lifecycle, constraints, and handoff behavior from candidate onboarding to Open Profile Visibility to Selected Employers.

## MVP and Future-State Scope
| Scope | Definition |
| --- | --- |
| MVP | Candidate selects up to 2 active role targets, receives coaching, and submits one target-specific visibility request routed through operators. |
| Future state | Rich employer-side workflow integration, automated routing policies, and package lifecycle analytics. |

## Lifecycle State Machine
| State | Description |
| --- | --- |
| `onboarding_incomplete` | Candidate baseline not complete |
| `evidence_profile_initializing` | Initial artifacts and sources being connected |
| `target_selection_required` | Candidate has no active role target |
| `target_selection_in_progress` | Capability Selection Agent flow active |
| `active_targets_set` | Candidate has 1 or 2 active role targets |
| `coaching_active` | Capability Fit Coaching in progress |
| `evidence_improvement` | Candidate executing actions and updating evidence |
| `visibility_ready_check` | Preconditions evaluated for selected target visibility action |
| `visibility_requested` | Open Profile Visibility request submitted |
| `operator_review_queue` | Internal operator queue processing request |
| `decision_ready_package_shared` | Package routed for recruiter review |
| `visibility_closed` | Workflow closed for this request |

State diagram:
`ONBOARDING_INCOMPLETE -> EVIDENCE_PROFILE_INITIALIZING -> TARGET_SELECTION_REQUIRED -> TARGET_SELECTION_IN_PROGRESS -> ACTIVE_TARGETS_SET -> COACHING_ACTIVE -> EVIDENCE_IMPROVEMENT -> VISIBILITY_READY_CHECK -> VISIBILITY_REQUESTED -> OPERATOR_REVIEW_QUEUE -> DECISION_READY_PACKAGE_SHARED -> VISIBILITY_CLOSED`

## Active Role Target Rules
| Rule ID | Rule |
| --- | --- |
| CTV-001 | Candidate must maintain at least 1 and at most 2 active role targets. |
| CTV-002 | Attempting to activate a third profile requires explicit replacement or archive action. |
| CTV-003 | Visibility request references exactly one selected active role target. |
| CTV-004 | Status transitions must be auditable with timestamp and actor context. |

## Permissions and Confirmations
| Requirement | Rule |
| --- | --- |
| Candidate authorization | Visibility request requires explicit candidate confirmation for selected target. |
| Consent detail | Confirmation must include profile URL, company, role, and timestamp. |
| Reconfirmation | Repeated visibility requests for same target may require reconfirmation after policy window. |

## `open_profile_visibility_requests` Contract
| Field | Requirement |
| --- | --- |
| `open_profile_visibility_request_id` | Required unique ID |
| `candidate_id` | Required canonical candidate identifier |
| `capability_profile_id` | Required selected target profile ID |
| `selected_company` | Required selected company value |
| `selected_role` | Required selected role value |
| `candidate_profile_url` | Required profile or package URL |
| `permission_confirmation` | Required metadata: confirmation timestamp, actor ID, confirmation copy version |
| `operator_notification_payload` | Required payload for internal queue or notification service |
| `status` | Required workflow state |
| `created_at` | Required timestamp |
| `updated_at` | Required timestamp |

## Operator Notification Workflow
| Step | Requirement |
| --- | --- |
| 1 | Receive `open_profile_visibility_request` event with full target and consent metadata |
| 2 | Validate candidate state and request policy constraints |
| 3 | Generate or verify Decision-Ready Candidate Package payload |
| 4 | Route curated package to recruiter workflow context |
| 5 | Record delivery status and close or requeue request |

## Recruiter and Operator Handoff Expectations
| Requirement | Rule |
| --- | --- |
| Target integrity | Handoff preserves exact selected company-role context |
| Evidence integrity | Strength and gap claims remain evidence-traceable |
| Non-ranking posture | Handoff does not inject ranking outputs |
| Operational traceability | Request lifecycle and handoff events are auditable |

## Anti-Spam Constraints
| Rule ID | Rule |
| --- | --- |
| CTV-SPAM-001 | Rate-limit repeated visibility requests for same target within policy window. |
| CTV-SPAM-002 | Prevent one-click broadcast to multiple employers. |
| CTV-SPAM-003 | Require candidate review before each new target visibility request. |
| CTV-SPAM-004 | Allow operator hold when abusive or duplicate request patterns are detected. |

## Failure Modes and Recovery
| Failure mode | Behavior |
| --- | --- |
| Missing active target | Block request and route candidate to target selection flow |
| Incomplete consent metadata | Block request and require reconfirmation |
| Operator queue unavailable | Store request in retryable queue state with status visibility |
| Package generation failure | Return retryable operator state, keep request auditable |

## Open Questions
- Final operational endpoint for visibility notifications: email alias, queue, or CRM target.
- Expected SLA for operator review after visibility action.

## Cross-References
- `docs/system/evidence-profile-terminology.md`
- `docs/features/capability-selection-agent-spec.md`
- `docs/features/capability-fit-coaching-agent-spec.md`
- `docs/features/recruiter-review-experience.md`
- `app/api/recruiter/README.md`
