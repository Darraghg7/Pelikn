/**
 * Display helpers for people's names. The one place initials and short names
 * are worked out — avatars, rota rows and log lines all use these, so the
 * same person reads the same way on every screen.
 */

// Splits into user-perceived characters, so "🇮🇪" or "é" (e + accent) stay whole.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function graphemes(s: string): string[] {
  return segmenter ? Array.from(segmenter.segment(s), seg => seg.segment) : Array.from(s)
}

const LETTER = /[\p{L}\p{N}]/u

/** First letter or digit in a word, skipping leading emoji, quotes and punctuation. */
function firstLetter(word: string): string {
  return graphemes(word).find(g => LETTER.test(g)) ?? ''
}

function words(name: string | null | undefined): string[] {
  return (name ?? '').trim().split(/\s+/).filter(w => LETTER.test(w))
}

/**
 * "Eve Turbitt" → "ET", "Mary Anne Smith" → "MS", "Sarah" → "SA",
 * "Mary-Kate" → "MK", "" → "?".
 *
 * Two words or more: first and last initial. A single name gives two letters
 * so people who only have a first name stay tell-apart-able.
 */
export function initials(name: string | null | undefined): string {
  const parts = words(name)
  if (parts.length === 0) return '?'
  if (parts.length > 1) return (firstLetter(parts[0]) + firstLetter(parts[parts.length - 1])).toUpperCase()

  const only = parts[0]
  // "Mary-Kate" → "MK": a hyphenated single name has two natural initials
  const halves = only.split('-').filter(h => LETTER.test(h))
  if (halves.length > 1) return (firstLetter(halves[0]) + firstLetter(halves[halves.length - 1])).toUpperCase()

  const letters = graphemes(only).filter(g => LETTER.test(g))
  return letters.slice(0, 2).join('').toUpperCase()
}

/**
 * "Darragh Guy" → "Darragh G.", "Sarah" → "Sarah", "" → "".
 * Tells apart staff who share a first name in tight spaces like the rota grid.
 */
export function shortName(name: string | null | undefined): string {
  const parts = words(name)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  const last = firstLetter(parts[parts.length - 1]).toUpperCase()
  return last ? `${parts[0]} ${last}.` : parts[0]
}

/** "Darragh Guy" → "Darragh". */
export function firstName(name: string | null | undefined): string {
  return words(name)[0] ?? ''
}
