# Candidate Explorer v1 Scoring Policy

## Purpose
Define when a candidate should be ranked in Candidate Explorer v1 versus routed to manual review, with clear recruiter guidance and auditable reason codes.

| Candidate state | Ranked? (Y/N) | Recruiter-facing label | UI copy | Recommended recruiter action | Audit log reason code |
|---|---|---|---|---|---|
| Normal rankable candidate | Y | Ranked: Ready for review | This candidate meets data quality and role-context requirements and has been ranked. | Review ranked profile and proceed with standard interview workflow if fit is strong. | `RANKED_NORMAL` |
| scanned-image resume | N | Unscored: Scanned resume | Resume is image-only or unreadable for reliable extraction; no automated rank shown. | Request a text-based resume or manually review profile evidence. | `UNSCORED_SCANNED_RESUME` |
| broken attachment | N | Unscored: Attachment issue | One or more required files could not be opened or parsed, so ranking is withheld. | Ask candidate to re-upload files and then re-run scoring. | `UNSCORED_BROKEN_ATTACHMENT` |
| duplicate candidate record | N | Unscored: Possible duplicate | Multiple records appear to represent the same candidate; ranking is paused to avoid double counting. | Merge/resolve duplicate records, then re-run scoring on the canonical record. | `UNSCORED_DUPLICATE_RECORD` |
| missing role requirements | N | Unscored: Role setup incomplete | Role requirements are missing or incomplete, so model comparison cannot be trusted. | Complete role requirements in ATS and re-run scoring. | `UNSCORED_MISSING_ROLE_REQUIREMENTS` |
| conflicting artifacts | N | Unscored: Conflicting evidence | Submitted artifacts disagree on key qualifications, preventing reliable automated ranking. | Manually verify qualifications and request clarifying information from candidate. | `UNSCORED_CONFLICTING_ARTIFACTS` |
| low extraction confidence | N | Unscored: Low confidence | Extracted candidate data is below confidence threshold, so no rank is assigned. | Perform manual review or request clearer/more complete candidate materials. | `UNSCORED_LOW_EXTRACTION_CONFIDENCE` |
| manual recruiter override | N | Override: Recruiter held from ranking | A recruiter manually removed this candidate from automated ranking for this review cycle. | Continue manual evaluation; optionally re-enable auto-scoring when ready. | `MANUAL_OVERRIDE_UNSCORED` |

## v1 Guardrail
Candidate Explorer v1 only auto-scores candidates that have already passed the traditional ATS filter (recruiter screen and knockout criteria). All other candidates remain outside ranked output.
