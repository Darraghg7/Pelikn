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
        cream:    '#f5f4f1',
        parchment:'#f0ede8',
        staffbg:  '#f5f4f1',
        charcoal: '#1a1a18',
        accent:   '#c94f2a',

        // Brand green scale — deep bottle green with lighter/darker variants
        brand: {
          DEFAULT: '#1a3c2e',
          50:  '#f0f7f4',
          100: '#d1e8db',
          200: '#a3d1b7',
          300: '#6bb893',
          400: '#3d9a6f',
          500: '#2a7c56',
          600: '#1f5e40',
          700: '#1a4a33',
          800: '#1a3c2e',
          900: '#0f2419',
        },

        // New design tokens
        surface:  '#F0F0EF',   // page background (neutral light gray)
        navpill:  '#E4EFE9',   // active bottom-nav pill background
        midgreen: '#4A7C5F',   // scores, rates, positive indicators

        danger:   { DEFAULT: '#dc2626', light: '#fee2e2' },
        warning:  { DEFAULT: '#d97706', light: '#fef3c7' },
        success:  { DEFAULT: '#16a34a', light: '#dcfce7' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        serif: ['Plus Jakarta Sans', 'sans-serif'],
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
