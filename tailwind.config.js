/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        turf: 'rgb(var(--turf) / <alpha-value>)',
        'turf-ink': 'rgb(var(--turf-ink) / <alpha-value>)',
        flood: 'rgb(var(--flood) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Barlow', '"Noto Kufi Arabic"', 'system-ui', 'sans-serif'],
        score: ['"Barlow Condensed"', '"Noto Kufi Arabic"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
