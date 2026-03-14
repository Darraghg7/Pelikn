/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:    '#f5f0e8',
        parchment:'#fffdf8',
        staffbg:  '#f3f4f6',
        charcoal: '#1a1a18',
        muted:    '#7a7060',
        accent:   '#c94f2a',
        danger:   { DEFAULT: '#dc2626', light: '#fee2e2' },
        warning:  { DEFAULT: '#d97706', light: '#fef3c7' },
        success:  { DEFAULT: '#16a34a', light: '#dcfce7' },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        serif: ['DM Serif Display', 'serif'],
      },
    },
  },
  plugins: [],
}
