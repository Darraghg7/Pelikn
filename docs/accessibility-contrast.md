# Colour contrast (last verified 14 Oct 2026)

WCAG 2.1 AA wants 4.5:1 for normal text (all the 11-13px labels count) and 3:1 for large text and meaningful icons. `npm run lint:contrast` (`scripts/contrast.mjs`, part of `npm run lint`) measures this on every run; `node scripts/contrast.mjs --report` prints the full tables.

## What the check measures
- Every text colour token on the surfaces it is used on (paper, page grey, cream inputs, brand tint, status tints; dark card and page; dark-green cards and sidebar).
- Every `text-<colour>/NN` class found in `src/`, as it actually renders. Plain `text-charcoal/NN` in dark mode is turned into `inkDark/NN` by `index.css`; the check reads those rules too.
- `disabled:` text is skipped (inactive controls are exempt from WCAG). `dark:text-ink` / `dark:text-charcoal` on a white chip are skipped.

## What changed (14 Oct 2026)
Before: 79 text classes failed on 4,700 uses (most: `text-charcoal/30-55`, `dark:text-white/25-45`, `text-white/40` on green cards). `ink3` and `warn` had already been darkened (earlier PR, 4.0 to 5.2:1 and 4.3 to 5.0:1).
1. **Readable-text floor** (`textAlphaFloor` in `tokens.js`, applied to every `text-*` class by `tailwind.config.js`): charcoal 62%, white 52%, cream 55%, brand 70%; translucent status text (`text-danger/70`) is drawn solid. The old hand-made "boost muted charcoal" block in `index.css` is gone (its 50/60/70 steps live in `textAlphaLift`); the dark-mode charcoal rules there no longer go below 55%.
2. `accent` `#c94f2a` to `#bb4624` (4.0 to 4.6:1 on its tint). New `accentDark` `#ec7f62` for accent text in dark mode (was 3.2:1); 11 `dark:text-accent` classes now say `dark:text-accentDark`.
3. Legacy `warning` token matches `warn` (`#9a5410`).
4. `ink4` used as text is drawn as `ink3` (placeholders, "no data" marks). It stays light for borders.
5. Decorative chevrons and the compliance ring track moved from `text-charcoal/25` to `stroke-charcoal/45`, so the floor does not darken them.

## Dark-mode gaps closed (14 Oct 2026)
- The check also reports any line that uses `text-ink`, `text-ink2` or `text-ink3` with no `dark:text-` partner. Those colours do not swap in dark mode and showed at about 3.2:1 (ink3) or worse.
- Five lines in the app had the gap (two staff-reorder arrows, two time-off balance figures, the "to" in the timesheet date range). Each now has `dark:text-white/45`, which the floor draws at AA.
- The public marketing page was the other source. It has no dark styles of its own, but the global dark rules turned its white mock-up cards dark on a cream page, leaving dark text on dark cards. It is now drawn light-only on purpose (`src/hooks/useForceLight.js` takes the `dark` class off `<html>` while it is shown), and `src/pages/marketing/` is the one documented exemption in the check (`LIGHT_ONLY_DIRS`).

## Known gaps
- The floor also darkens any other `currentColor` icon that used a faint `text-*` class; use `stroke-*`/`fill-*` for decoration.
- Contrast is measured on the worst surface for each colour family, not per element.
- The partner check is per line, so a line that has a `dark:text-` for one element and a bare `text-ink3` for another is not caught.

Last verified: 14 Oct 2026 (`npm run lint:contrast`: 105 classes, 28 token pairs, no missing partners).

## Exceptions
None. Add to `KNOWN_EXCEPTIONS` in `scripts/contrast.mjs` with a reason if one is ever needed.
