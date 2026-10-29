// Colours that change between light and dark mode are CSS variables (see src/styles/index.css),
// so components keep using ordinary utilities (bg-gray-50, text-green-800, bg-brand-600 ...).
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // One step up from Tailwind's defaults: the smallest text was hard to read on a phone
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.9rem', { lineHeight: '1.3rem' }],
      },
      colors: {
        surface: v('surface'),
        brand: {
          50: v('brand-50'),
          100: v('brand-100'),
          400: v('brand-400'),
          500: v('brand-500'),
          600: v('brand-600'),
          700: v('brand-700'),
        },
        gray: {
          50: v('gray-50'),
          100: v('gray-100'),
          200: v('gray-200'),
          300: v('gray-300'),
          400: v('gray-400'),
          500: v('gray-500'),
          600: v('gray-600'),
          700: v('gray-700'),
          800: v('gray-800'),
          900: v('gray-900'),
        },
        // Status colours: the 500 / 400 shades stay Tailwind's (green-500, amber-400, red-500);
        // only the tints and text shades adapt to dark mode.
        green: { 50: v('green-50'), 100: v('green-100'), 700: v('green-700'), 800: v('green-800') },
        amber: { 50: v('amber-50'), 100: v('amber-100'), 600: v('amber-600'), 800: v('amber-800') },
        red: { 50: v('red-50'), 100: v('red-100'), 600: v('red-600'), 800: v('red-800') },
        violet: { 100: v('violet-100'), 800: v('violet-800') },
        sky: { 100: v('sky-100'), 800: v('sky-800') },
      },
    },
  },
  plugins: [],
}
