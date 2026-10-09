import { colors, alpha } from './src/lib/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // All colours live in src/lib/tokens.js — add or change them there.
      colors,
      // Tailwind's default scale only has 5-step opacities (5, 10, 15 …), so
      // classes like bg-charcoal/8 or border-charcoal/12 silently generated no
      // CSS. These are the extra steps used across src/ — add any new one here.
      opacity: {
        2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08',
        9: '0.09', 12: '0.12', 14: '0.14', 16: '0.16', 18: '0.18', 22: '0.22',
        28: '0.28', 38: '0.38', 68: '0.68', 87: '0.87', 88: '0.88', 92: '0.92',
      },
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
