# Colour contrast audit (13 Oct 2026)

Measured, not fixed: changing these is a design decision. WCAG AA wants 4.5:1 for normal text (the 11–13px labels all count as normal) and 3:1 for large text and icons.

## Token pairs (tokens in `src/lib/tokens.js`)

| Pair | Ratio | AA |
|---|---|---|
| `ink` / `ink2` on white | 13+ / 9.3 | pass |
| `brand` on white | 13.2 | pass |
| `good`, `bad`, `info` on their `*Bg` tints | 4.55, 5.3, 8.0 | pass (good only just) |
| `warn` on `warnBg` | 4.33 | **fail, narrowly** |
| `accent` on white | 4.53 | pass (only just) |
| `ink3` on white | 4.04 | **fail** |
| `ink3` on the page background `bg` | 3.63 | **fail** |
| `ink4` on white | 2.00 | **fail** (fine for borders and disabled text, not for reading) |
| `*Dark` status colours on `paperDark` | 7.7–9.2 | pass |

## Opacity text (the bigger problem)

Text set with an opacity on `charcoal` (light mode) or `white` (dark mode) is used far more than the tokens above.

| Class | Ratio | AA |
|---|---|---|
| `text-charcoal/60` and darker | 4.55+ | pass |
| `text-charcoal/55` | 3.9 | fail |
| `text-charcoal/50` | 3.4 | fail |
| `text-charcoal/40` | 2.5 | fail |
| `text-charcoal/30` | 1.9 | fail |
| dark mode `text-white/55` | 5.9 | pass |
| dark mode `text-white/45` | 4.4 | fail, narrowly |
| dark mode `text-white/40` | 3.8 | fail |
| dark mode `text-white/35` | 3.2 | fail |

Usage counts in `src/`: about 1,280 `text-charcoal/<=55`-style classes, 1,390 `dark:text-white/<50`-style classes, 222 `text-ink3`, 39 `text-ink4`.

## What a fix would look like (needs a design call)
- Darken `ink3` from `#76817b` to about `#656f69` (4.7:1 on the page background, 5.2:1 on white). One line in tokens.js, and the secondary text looks a little darker everywhere it is used.
- Move text-only uses of `text-charcoal/30–55` up to `/60` and `dark:text-white/<50` up to `/55`. Mechanical, but about 2,600 edits and a visible change in how quiet the UI feels. A ratchet like `lint:colours` would stop it creeping back.
- Darken `warn` slightly (`#a85d12` to about `#9a5410`) for the badge-on-tint case.
