# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run test         # Run unit tests with Vitest (one-time)
npm run test:watch   # Run tests in watch mode
npm run test:smoke   # Run Playwright E2E smoke tests
```

**Run a single unit test:**
```bash
npm run test -- tests/unit/magic-link-auth.test.ts
```

**Apply database migrations:**
```bash
supabase db push
```

## Architecture

This is a **multi-persona recruiting platform** built on Next.js (App Router) + Supabase. Three user personas exist: **student**, **recruiter**, and **org_admin**.

### Layer Overview

- **`/app`** — Next.js App Router pages and API routes, organized by persona (`/student`, `/recruiter`, `/admin`)
- **`/lib`** — Core business logic: auth, authorization, feature flags, AI quotas, email, Supabase client
- **`/components`** — React UI components; `/components/mock/` contains stub pages used before full backend features are built
- **`/supabase/migrations`** — SQL migrations; apply with `supabase db push`
- **`/tests/unit`** — Vitest unit tests; **`/tests/smoke`** — Playwright E2E tests

### Auth Flow

Three login methods exist:

1. **Magic Link** (students + recruiters): `/login/{student|recruiter}` → POST `/api/auth/login/{student|recruiter}` → Supabase OTP email → `/auth/callback` → redirect to persona home. A `stu-magic-link-intent` cookie tracks intended persona through the flow.

2. **Staff Password**: `/login/staff` → POST `/api/auth/login/staff` — for org_admin users.

3. **Dev Identity** (development only): GET `/api/auth/dev-login?persona={student|recruiter|org_admin}`. Only active when `ENABLE_DEV_IDENTITIES=true`. Uses `stu-dev-persona` cookie to bypass real auth.

Auth context is built by `getAuthContext()` in `lib/auth-context.ts`, which returns an `AuthContext` containing: `user_id`, `org_id`, `persona`, `assignment_ids`, and a profile snapshot.

### Route Protection

- `proxy.ts` middleware checks session and blocks unauthenticated access (controlled by `ENABLE_SESSION_CHECK` env var)
- `lib/route-policy.ts` defines `routePersonaPolicy` — which personas can access which routes
- `lib/authorization.ts` — `hasPersona()` validates persona access with optional onboarding requirements

### Feature Flags

`lib/feature-flags.ts` controls student feature rollout. Features: `artifactRepository`, `capabilityDashboard`, `pathwayPlanner`, `aiGuidance`, `interviewPrep`, `manageRoles`. Flags are served via `FeatureFlagsProvider` in the component tree.

### AI Quota System

`lib/ai/` tracks per-user AI feature usage against a configurable cap (`AI_FEATURE_MAX_USES` env var, default 5). Checked before calling OpenAI.

### Key Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
ENABLE_SESSION_CHECK / NEXT_PUBLIC_ENABLE_SESSION_CHECK
ENABLE_DEV_IDENTITIES
AI_FEATURE_MAX_USES
OPENAI_API_KEY
TRANSCRIPT_MAX_UPLOAD_BYTES
RESEND_API_KEY
RECRUITER_APPROVAL_FUNCTION_URL
```

### Testing Notes

- Unit tests use `vi.mock()` heavily — Supabase client and other dependencies are mocked at the module level
- Smoke tests in `playwright.config.ts` auto-start the dev server and run against `localhost:3000`
- Vitest is configured in `vitest.config.ts` with Node environment and `@/*` path alias resolution
