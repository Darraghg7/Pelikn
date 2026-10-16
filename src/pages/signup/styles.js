// Shared look for the signup flow. It follows the public marketing page: big,
// light, tightly-tracked headlines on a cream page, white rounded cards and
// pill buttons. The page is forced to light colours (useForceLight), so none
// of this needs dark-mode partners.

/** Page headline: same weight and tracking as the marketing headlines. */
export const HEADLINE = { fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 0.95, letterSpacing: '-0.05em', fontWeight: 500 }

/** Small mono caption above a group of fields. */
export const LABEL = 'block font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70 mb-3'

/** Text input. Big, rounded, white on the cream page. */
export const INPUT = 'w-full h-14 px-5 rounded-control border border-charcoal/15 bg-paper text-body-lg text-charcoal placeholder:text-charcoal/50 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all'

/** Helper text under a field. */
export const HINT = 'text-body-sm text-charcoal/70 mt-2 px-1'
