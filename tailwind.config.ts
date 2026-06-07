import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,html}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-sans)'],
      },
      fontSize: {
        display: ['56px', { lineHeight: '1.07', letterSpacing: '-0.022em', fontWeight: '600' }],
        h1: ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['28px', { lineHeight: '1.14', letterSpacing: '-0.016em', fontWeight: '600' }],
        body: ['15px', { lineHeight: '1.5', letterSpacing: '-0.003em' }],
        caption: ['12px', { lineHeight: '1.4', letterSpacing: '0' }],
      },
    },
  },
  plugins: [],
} satisfies Config
