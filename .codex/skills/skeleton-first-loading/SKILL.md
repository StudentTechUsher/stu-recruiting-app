---
name: skeleton-first-loading
description: Enforce skeleton-first loading UX for this repository. Use when implementing or modifying any page, section, card, or container that fetches or computes data before rendering user-visible content. Apply to React/Next.js components, route pages, and async client/server UI where users would otherwise see empty states, jumps, or delayed content pop-in.
---

# Skeleton First Loading

Implement consistent loading skeletons so async content appears intentional and stable instead of blank, shifting, or popping in.

## Repository Rule

Apply this rule by default:

- If UI content depends on fetched/processed data and is not immediately available, render skeleton placeholders that match the final layout footprint.
- Do not use text-only placeholders like "Loading..." for primary content blocks unless the block is tiny and non-structural.
- Keep actions disabled or hidden until data is ready.

## Workflow

1. Identify loading boundaries.
- Find each container/card/section that waits on data.
- Use one loading boolean per boundary when possible (`isLoadingProfile`, `isLoadingTargets`, etc.), or an existing consolidated state if it does not cause flicker.

2. Mirror final structure in skeleton form.
- Match approximate dimensions and spacing of headings, chips, rows, inputs, and buttons.
- Preserve card layout so content does not shift on hydration.

3. Render skeletons in-place.
- Keep skeleton logic in the same component when local.
- Extract shared skeleton helpers if the shape repeats.
- Prefer class reuse (`skeletonBlockClassName`) over ad hoc styles.

4. Swap cleanly from skeleton to real data.
- Hide skeleton and show real content in one branch switch (`isLoading ? skeleton : content`).
- Avoid mixing stale placeholders with interactive controls.

5. Validate.
- Confirm no empty flash or major layout jump on slow network/dev throttling.
- Confirm actions are not prematurely clickable during loading.

## Implementation Standards

- Use `animate-pulse` with neutral block colors that fit current theme.
- Mark decorative skeleton elements as `aria-hidden="true"` when needed.
- Keep skeleton markup lightweight; do not over-nest.
- Keep count-based summaries and status badges skeletonized too if their values load async.

## PR Checklist

- Every async-loaded primary section has a skeleton state.
- Skeleton geometry resembles final geometry.
- No "pop-in" of large content blocks after initial paint.
- No broken tab order or misleading interactive affordances during loading.
- Typecheck/lint still pass.

## Examples In This Repo

- `components/mock/StudentManageRoles/StudentManageRoles.tsx`
  - `renderTargetSelectionSkeleton`
  - `renderProfileDetailsSkeleton`
  - `renderProfileLinksSkeleton`
