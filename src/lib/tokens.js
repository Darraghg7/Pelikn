// The one place colours are defined. tailwind.config.js reads `colors` from
// here, so `bg-brand`, `text-warnDark` and friends come from this file too.
//
// In components, use the Tailwind class (`text-bad dark:text-badDark`). Only
// reach for this file when a colour has to be a JS value: inline styles that
// are computed, canvas drawing, jsPDF, native status bars. Never type a hex
// value or rgba() anywhere else in src/ — `npm run lint:colours` will fail.

export const colors = {
  // Ink scale
  ink:   '#0d1a14',
  ink2:  '#3d4a44',
  ink3:  '#76817b',
  ink4:  '#b3b9b5',
  inkDark: '#e8e4dc',   // body text in dark mode

  // Surfaces
  bg:        '#f3f3ef',
  paper:     '#ffffff', // always white, even in dark mode (bg-white flips; bg-paper doesn't)
  paperDark: '#1e1e1e', // dark-mode card surface
  bgDark:    '#111111', // dark-mode page background
  line:  '#e4e6e2',
  line2: '#eef0ec',

  // Brand
  brand: {
    DEFAULT: '#13362a',
    tint:    '#eef4f0',
    soft:    '#e2ece7',
    // Legacy scale kept for any existing references
    50:  '#f0f7f4',
    100: '#d1e8db',
    200: '#a3d1b7',
    300: '#6bb893',
    400: '#3d9a6f',
    500: '#2a7c56',
    600: '#1f5e40',
    700: '#1a4a33',
    800: '#13362a',
    900: '#0a1f19',
  },
  // Desktop sidebar: a slightly lighter green than brand, on purpose.
  sidebar: {
    rail:  '#1c2f2a',
    panel: '#243a34',
  },
  // Login + launch screen. Must match the native splash (index.html,
  // scripts/render-ios-splash.mjs) or the app flashes on open.
  pine: {
    DEFAULT: '#2a4a40',
    light:   '#2d5449',
    deep:    '#1a3d35',
    glow:    '#4a7d6e',
  },
  accent:   '#c94f2a',
  accentBg: '#faeee9',

  // Status. *Bg = light tint behind status text. *Dark = status text on dark
  // surfaces (dark mode, and the dark-green cards in light mode).
  good:     '#1a7a4c',
  goodBg:   '#e3f0e7',
  goodDark: '#7fd1a4',
  warn:     '#a85d12',
  warnBg:   '#fbeedc',
  warnDark: '#e8b06a',
  bad:      '#b3331c',
  badBg:    '#fbeae6',
  badDark:  '#f19a86',
  severe:   '#7a1d0c',
  severeBg: '#f5dbd7',
  info:     '#2c4577',
  infoBg:   '#e7edf6',
  infoDark: '#a9bfe8',

  // Category colours for things people label: calendar events, rota stations.
  // Forest, rust, ocean and amber reuse brand/accent/info/warn.
  category: {
    slate:   '#4a5568',
    slateBg: '#edf0f4',
    plum:    '#6b3d7a',
    plumBg:  '#f0e8f5',
    teal:    '#2d7d6e',
  },

  // Printed allergen labels and the HACCP plan: pure black on white.
  print: {
    ink:   '#000000',
    muted: '#555555',
    rule:  '#cccccc',
  },

  // Other companies' colours, kept exact.
  whatsapp: '#25d366',

  // ── Legacy aliases kept for backwards compat ───────────────────────
  cream:    '#f5f4f1',
  charcoal: '#1a1a18',
  surface:  '#f3f3ef',
  navpill:  '#eef4f0',
  midgreen: '#1a7a4c',
  danger:   { DEFAULT: '#b3331c', light: '#fbeae6' },
  warning:  { DEFAULT: '#a85d12', light: '#fbeedc' },
  success:  { DEFAULT: '#1a7a4c', light: '#e3f0e7' },
}

// The type scale. tailwind.config.js reads this, so each step is a class:
// `text-micro`, `text-caption`, `text-body-sm` and so on. Use these instead of
// one-off sizes like text-body-sm — `npm run lint:type` counts those per file.
// Line heights sit close to 1.5 so text keeps the spacing it had before.
//
//   micro     11px  labels, eyebrows, counts, badges (pair labels with
//                   `uppercase tracking-widest`; Geist Mono labels use 0.08em)
//   caption   12px  helper text, timestamps, meta lines under a title
//   body-sm   13px  secondary rows and descriptions
//   body      14px  default reading text (same size as Tailwind's text-sm)
//   body-lg   15px  list-row titles, large buttons
//   title-sm  17px  sheet and card headings
//   title     22px  section headings, mid-size figures
//   display   28px  page titles, figures in stat cards
//   stat      34px  the largest dashboard figures
//
// Below 11px is only for the dense views (rota week grid, Gantt chart) and the
// shrunken product pictures on the marketing page.
export const fontSize = {
  micro:      ['11px', { lineHeight: '16px' }],
  caption:    ['12px', { lineHeight: '18px' }],
  'body-sm':  ['13px', { lineHeight: '20px' }],
  body:       ['14px', { lineHeight: '20px' }],
  'body-lg':  ['15px', { lineHeight: '22px' }],
  'title-sm': ['17px', { lineHeight: '24px' }],
  title:      ['22px', { lineHeight: '28px' }],
  display:    ['28px', { lineHeight: '34px' }],
  stat:       ['34px', { lineHeight: '40px' }],
}

// The app icon choices mirror the real icon image files in ios/ and android/.
export const appIconColors = {
  white: '#ffffff',
  green: '#1e3a2f',
  black: '#1a1a18',
  mint:  '#5eeaaa',
}

// Rota colours people pick for each staff member. The chosen value is saved
// on the staff row, so changing one here would orphan existing choices.
export const staffPalette = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

/** '#13362a' → [19, 54, 42] (for jsPDF and canvas maths). */
export function rgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

/** A token at some opacity, for inline styles: alpha(colors.ink, 0.42). */
export function alpha(hex, a) {
  return `rgba(${rgb(hex).join(',')},${a})`
}

/** White or black at some opacity — overlays on coloured surfaces. */
export const white = a => (a == null ? '#ffffff' : `rgba(255,255,255,${a})`)
export const black = a => (a == null ? '#000000' : `rgba(0,0,0,${a})`)
