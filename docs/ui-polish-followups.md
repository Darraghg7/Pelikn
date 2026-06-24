# UI polish — follow-ups

A calibrated type-floor polish pass landed on branch `polish/ui-calibrated-type-floor`: focus-ring bug fix, background/token consolidation, and the Home (mobile manager) dashboard. The standard it follows is documented in `.impeccable.md`. These are the deliberately-deferred items.

## Ticket 1 — Rota week-grid (decision: keep close to current)
`src/pages/rota/RotaWeekView.jsx` uses `text-[7px]`/`text-[8px]` cells to fit the week grid; `RotaMobileGrid.jsx` uses 9–10px.

**Decision (2026-06-24): keep the current dense design.** It's liked as-is and treated as an intentional dense view, like the mono-uppercase micro-label ramp — so the 11px type floor is deliberately **not** forced here, and no structural redesign is planned.

If legibility is ever revisited, prefer non-layout-changing tweaks first (contrast, weight) before any structural change (columns / horizontal scroll / abbreviations).

## Ticket 2 — Systemic design-system consolidation (higher leverage than more label-bumping)
Larger refactor, biggest long-term payoff:
- ~377 hardcoded hex values across JSX → migrate to `tailwind.config.js` tokens.
- ~10 ad-hoc `shadow-[...]` values → 3–4 named elevation tokens (reuse `shadow-dropdown`/`shadow-modal`).
- Collapse legacy aliases (`cream`/`charcoal`/`surface`) into the spec tokens (`ink`/`paper`/`bg`/`line`).
- ~39 `!important`s in `index.css` to unwind as part of the above.

## Continuation — roll out the calibrated floor to remaining floor-able screens
Same workstream as this branch, just more screens (forms/hubs/settings/HR/staff/signup/training/team). ~40 files. Per-screen, verify at 375px, watch for hidden tight spots (like the dashboard 3-col stat grid) and special-case rather than blanket-bump. Exclude the rota dense grids (Ticket 1).
