# Artifact Verification Methods

## Purpose
Define what a student must do to get each artifact type marked as verified, and document which verification paths are live today versus planned.

## Verification States
- `verified`: artifact evidence has passed an accepted verification path.
- `pending`: evidence has been submitted, but verification has not completed yet.
- `unverified`: extracted or user-entered artifact without accepted verification evidence.

## Verification Methods Used in Artifact Data
- `transcript_parse` (verified)
- `transcript_extraction` (verified)
- `github_extraction` (verified)
- `kaggle_extraction` (verified)
- `syllabus_upload` (pending until verifier marks verified)
- `resume_extraction` (unverified)
- `linkedin_extraction` (unverified)

## Verification Requirements By Artifact Type

| Artifact type | What the student has to do | Resulting status/method |
| --- | --- | --- |
| `coursework` | Path A (live): upload transcript, run transcript parse, and materialize courses from parsed transcript data. | `verified` + `transcript_parse` |
| `coursework` | Path B (target): submit coursework with syllabus; AI verifies syllabus matches course code and course description. | `pending` + `syllabus_upload` until verification; then `verified` |
| `project` | Live verified path: connect GitHub and extract project evidence from profile/repos. | `verified` + `github_extraction` |
| `project` | Live verified path: connect Kaggle profile and extract project evidence. | `verified` + `kaggle_extraction` |
| `project` | Resume/LinkedIn/manual entry path: upload from resume or LinkedIn, or create manually, then attach supporting docs for reviewer/AI verification. | Currently stays `unverified` (`resume_extraction` / `linkedin_extraction`) until a verifier flow is added |
| `internship` | Provide official internship evidence (offer letter, manager verification, or equivalent supporting file) tied to the artifact. | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `employment` | Provide official employment evidence (offer letter, HR/manager verification, or equivalent supporting file). | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `certification` | Provide certificate file and/or credential URL that can be validated against issuer details. | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `leadership` | Provide leadership evidence (official role listing, letter, or roster with role and org). | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `club` | Provide membership evidence (club roster, membership letter, or equivalent source). | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `competition` | Provide official competition results evidence (ranking page, certificate, or organizer-issued proof). | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `research` | Provide research evidence (publication link/DOI, poster, advisor verification, or equivalent proof). | Target: `verified` after reviewer/AI verification (not fully automated yet) |
| `test` | Provide official assessment report (score report or provider-validated result). | Target: `verified` after reviewer/AI verification (not fully automated yet) |

## Current Implementation Notes
- Transcript/GitHub/Kaggle extraction paths can produce artifacts that are immediately marked verified.
- Resume and LinkedIn extraction paths are intentionally marked unverified.
- Coursework created without transcript provenance currently requires syllabus evidence and is marked pending via `syllabus_upload`.
- The syllabus AI match (course code + description validation) is the intended coursework verification completion step and should be the first verifier automation to ship.
