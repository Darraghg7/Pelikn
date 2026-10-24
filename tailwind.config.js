import { colors, alpha, fontSize, radius, textAlphaFloor, effectiveTextAlpha } from './src/lib/tokens.js'

// Text colours that honour the readable-text floor in tokens.js. Everything else
// about the colour (and every non-text use of it) is unchanged.
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ')
const flooredText = (name, hex) => ({ opacityValue }) => {
  const a = Number(opacityValue)
  return `rgb(${hexToRgb(hex)} / ${Number.isNaN(a) ? 'var(--tw-text-opacity, 1)' : effectiveTextAlpha(name, a)})`
}
const textColor = Object.fromEntries(Object.keys(textAlphaFloor).map(name => {
  const c = name === 'white' ? '#ffffff' : colors[name]
  return [name, typeof c === 'string' ? flooredText(name, c) : { DEFAULT: flooredText(name, c.DEFAULT) }]
}))
// ink4 is a border/divider grey; used as text it reads as ink3.
textColor.ink4 = colors.ink3

/** @type {import('tailwindcss').Config} */
export default {
  // hover: styles only apply on devices with a real mouse. On phones a tap
  // first "hovers", and iOS can swallow that tap when the hover changes what
  // is shown (the tick appearing in a check circle), so staff had to tap twice.
  future: { hoverOnlyWhenSupported: true },
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // All colours live in src/lib/tokens.js — add or change them there.
      colors,
      textColor,
      // Tailwind's default scale only has 5-step opacities (5, 10, 15 …), so
      // classes like bg-charcoal/8 or border-charcoal/12 silently generated no
      // CSS. These are the extra steps used across src/ — add any new one here.
      opacity: {
        2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08',
        9: '0.09', 12: '0.12', 14: '0.14', 16: '0.16', 18: '0.18', 22: '0.22',
        28: '0.28', 38: '0.38', 68: '0.68', 87: '0.87', 88: '0.88', 92: '0.92',
      },
      // The type scale (text-micro … text-stat) also lives in src/lib/tokens.js.
      fontSize,
      borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
      fontFamily: {
        sans:  ['Geist', '-apple-system', 'system-ui', 'sans-serif'],
        mono:  ['Geist Mono', 'ui-monospace', 'monospace'],
        serif: ['Geist', 'sans-serif'],
      },
      boxShadow: {
        'dropdown': `0 8px 28px ${alpha(colors.charcoal, 0.10)}, 0 2px 6px ${alpha(colors.charcoal, 0.04)}`,
        'modal':    `0 16px 48px ${alpha(colors.charcoal, 0.12)}, 0 4px 12px ${alpha(colors.charcoal, 0.06)}`,
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:       'shimmer 2.5s ease-in-out infinite',
        'fade-in':     'fade-in 0.2s ease-out',
        'slide-up':    'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [
    // `idle-disabled:` = disabled but not loading. Button keeps its colour while
    // a save is in flight (aria-busy) and only greys out when truly unavailable.
    function ({ addVariant }) {
      addVariant('idle-disabled', '&:disabled:not([aria-busy])')
    },
  ],
}
