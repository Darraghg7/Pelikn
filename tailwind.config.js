/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Spec design tokens (exact) ─────────────────────────────────────
        // Ink scale
        ink:   '#0d1a14',
        ink2:  '#3d4a44',
        ink3:  '#76817b',
        ink4:  '#b3b9b5',

        // Surfaces
        bg:    '#f3f3ef',
        paper: '#ffffff',
        paperDark: '#1e1e1e',  // dark-mode card surface
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

        // Status
        good:    '#1a7a4c',
        goodBg:  '#e3f0e7',
        warn:    '#a85d12',
        warnBg:  '#fbeedc',
        bad:     '#b3331c',
        badBg:   '#fbeae6',
        severe:  '#7a1d0c',
        info:    '#2c4577',
        infoBg:  '#e7edf6',
        accent:  '#c94f2a',

        // ── Legacy aliases kept for backwards compat ───────────────────────
        cream:    '#f5f4f1',
        charcoal: '#1a1a18',
        surface:  '#f3f3ef',
        navpill:  '#eef4f0',
        midgreen: '#1a7a4c',
        danger:   { DEFAULT: '#b3331c', light: '#fbeae6' },
        warning:  { DEFAULT: '#a85d12', light: '#fbeedc' },
        success:  { DEFAULT: '#1a7a4c', light: '#e3f0e7' },
      },
      fontFamily: {
        sans:  ['Geist', '-apple-system', 'system-ui', 'sans-serif'],
        mono:  ['Geist Mono', 'ui-monospace', 'monospace'],
        serif: ['Geist', 'sans-serif'],
      },
      boxShadow: {
        'dropdown': '0 8px 28px rgba(26,26,24,0.10), 0 2px 6px rgba(26,26,24,0.04)',
        'modal':    '0 16px 48px rgba(26,26,24,0.12), 0 4px 12px rgba(26,26,24,0.06)',
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
  plugins: [],
}
