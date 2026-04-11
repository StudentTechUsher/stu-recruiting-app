# Design Review: "Does This Look AI-Generated?"

Honest assessment of patterns in the Stu Recruiting UI that could signal AI-generated design to a trained eye, plus concrete fixes.

---

## The Good News First

The app is genuinely well-built. It has responsive layouts, dark mode, mobile-safe insets, and a coherent color system. The ex-Google feedback makes sense — the *quality bar* is high. The risk isn't that it looks *bad*, it's that it looks *generated*. There's a difference. A design-literate person (hiring manager, investor, designer friend) might not think "this is ugly" but could think "this feels like it came out of a prompt."

---

## Top Signals That Read as AI-Generated

### 1. The Uppercase Tracking Epidemic

Almost every label in the app uses this exact pattern:

```
text-xs font-semibold uppercase tracking-[0.08em]
text-xs font-semibold uppercase tracking-[0.12em]
text-[11px] font-semibold uppercase tracking-[0.1em]
```

This "small-caps eyebrow" pattern appears on the login chooser, every nav label, every dashboard section header, every metric card, and every form label. Real products use this sparingly — maybe for one category label or a nav section divider. When *everything* is an uppercase tracked eyebrow, it reads as a single design token applied mechanically everywhere.

**Fix:** Reserve uppercase tracking for one specific UI role (e.g., section headers in the sidebar). Use normal-case `text-xs font-medium text-slate-500` for form labels, card categories, and secondary text. Vary the hierarchy instead of repeating one pattern.

---

### 2. The Radial Gradient Background

```
bg-[radial-gradient(circle_at_top_left,#d7ffe8_0,#f4fbf7_45%,#f8fff9_100%)]
```

This exact gradient appears on every auth screen. Radial gradient backgrounds positioned at a corner are one of the most common AI-generated landing page patterns. It's the visual equivalent of "In today's fast-paced world..."

**Fix:** Try a flat `bg-[#f4fbf7]` or `bg-white` for auth pages. If you want visual interest, use a single subtle noise texture or a geometric SVG pattern at low opacity. Less is more here — confidence in simplicity reads as human.

---

### 3. One Green to Rule Them All

The entire app is emerald. Backgrounds, borders, text, buttons, active states, icons, skeletons — all green. There's no secondary accent color. Real products almost always have a primary + secondary color (even if the secondary is just used for links or interactive elements).

Current palette:
- `#0fd978` / `#12f987` — buttons, active states
- `#0a1f1a` — text
- `#f4fbf7` / `#f8fcfa` / `#f5faf7` — backgrounds (three nearly identical greens)
- `#bfd2ca` / `#d2e1db` / `#d6e1db` — borders (three nearly identical greens)

That's about 8 shades of the same hue doing every job.

**Fix:** Introduce a secondary color for interactive/accent moments. A warm neutral (slate or zinc) for borders and secondary text instead of green-tinted grays. Keep emerald for the brand mark, primary buttons, and success states — but not for *everything*. The three near-identical background greens should collapse to one.

---

### 4. Backdrop Blur + Soft Shadow on Everything

```
shadow-[0_24px_54px_-36px_rgba(10,31,26,0.5)]
backdrop-filter: blur(12px)
```

Glassmorphism and ultra-soft shadows are the "I asked AI to make it look premium" starter pack. The sidebar uses backdrop blur. The login card has a deeply diffused shadow. These are fine individually but when combined with the gradient backgrounds and rounded corners, they stack into a recognizable aesthetic.

**Fix:** Pick one depth treatment and stick with it. Either use a subtle shadow *or* a border — not both on the same element. Drop the backdrop blur on the sidebar; use a solid background with maybe 95% opacity if you want a slight transparency effect.

---

### 5. Copy That Sounds Like a Product Spec

Some of the UI text reads more like internal documentation than user-facing copy:

- "Add evidence to populate capability coverage"
- "Coverage complete. Verification is the current priority"
- "Explanatory view only. It compares target expectations against current evidence coverage"
- "Use your campus email to receive a secure sign-in link"
- "Track readiness and priority actions"

These are *accurate* but they sound like they were generated from a feature description. Real product copy has a point of view, uses shorter phrases, and sometimes breaks grammatical rules for rhythm.

**Fix examples:**
| Current | More human |
|---|---|
| "Add evidence to populate capability coverage" | "Add your first piece of evidence to get started" |
| "Coverage complete. Verification is the current priority" | "Nice coverage — now get some of it verified" |
| "Use your campus email to receive a secure sign-in link" | "We'll email you a sign-in link" |
| "Track readiness and priority actions" | "What to do next" |

The goal isn't to be casual — it's to sound like a person wrote it rather than a requirements doc.

---

### 6. Perfect Symmetry Everywhere

Every layout is a perfectly even grid: `grid-cols-3` for login options, `grid-cols-4` for metric cards, `grid-cols-2` for evidence sections. No element is intentionally larger or more prominent than its neighbors.

Real designs use hierarchy: the most important card is bigger, or one column is wider than the other, or there's a featured/highlighted option. Perfect symmetry signals that no design judgment was applied — everything was treated equally by default.

**Fix:** On the login chooser, if students are your primary audience, make that card visually dominant (larger, different background, or positioned first with more whitespace). On the dashboard, make the primary metric card span two columns or use a larger font size. Create intentional visual weight.

---

### 7. Inter as the Only Font

Inter is to AI-generated UIs what Lorem Ipsum is to placeholder text — it's the default. It's a fine font, but using it as the sole typeface with no personality adjustments (no custom weights, no display variant for headings) is a tell.

**Fix:** You don't need to switch fonts entirely. Just using Inter's display optical size for headings (`font-variation-settings: 'opsz' 32`) or pairing it with a slightly different heading weight (like 800 for the main dashboard greeting vs. 600 for card titles) adds differentiation. Or swap headings to something like Instrument Sans or Geist — both free, both pair well with Inter body text.

---

### 8. The Metric Card Assembly Line

Every metric on the dashboard follows the identical structure: tone border → tone background → label → value → helper text → optional CTA. The tone system (success/warning/danger mapped to emerald/amber/rose) is applied uniformly. This reads as a component that was spec'd once and stamped out.

**Fix:** Not every metric needs the same visual treatment. The "overall hiring signal" is more important than individual coverage scores — give it a distinct layout (maybe a larger card with a ring/donut chart instead of a number). Let some metrics be simpler (just a number and label, no card wrapper). Visual variety signals that a human made choices about what matters.

---

## Lower Priority but Worth Noting

- **"Coming Soon" badges** scattered across the nav feel like an MVP placeholder. If features aren't ready, consider hiding them entirely rather than teasing — it undermines the "polished product" impression.
- **Skeleton loaders** all use the same `animate-pulse` with the same green-gray color. Custom skeleton shapes that match the actual content layout would feel more intentional.
- **Error messages** are correct but clinical: "Unable to load dashboard right now." Adding a subtle retry CTA or a less robotic tone would help.
- **The brand mark "stu."** is fine but the trailing period is a very AI-logo pattern (see: every YC startup pitch deck generated in 2024). Not a dealbreaker, just worth being aware of.

---

## Summary: What to Tackle First

If you only do three things:

1. **Kill the uppercase tracking overuse** — this is the single biggest tell. It takes 30 minutes to audit and fix.
2. **Humanize the copy** — rewrite the 10-15 most-visible strings (dashboard greeting, metric labels, login descriptions). Another 30 minutes.
3. **Add a secondary color** — even just making borders and muted text a neutral gray instead of green-tinted removes the "monochrome generated palette" feel.

These three changes would meaningfully shift the perception from "generated" to "designed."
