/**
 * Tailwind config del sandbox: ricostruisce i design-token custom che il modulo
 * BugBay si aspetta dall'host (palette semantica, scala di spaziatura `s-*`,
 * tipografia `d2/h1/h3/label`, raggi `pill/sm/md`, ombre `sh-*`, tracking
 * `brand/label`, famiglie font via CSS variable). Senza questi la console
 * apparirebbe priva di stile. I font sono iniettati da next/font nel layout.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // colori semantici della pipeline (bare, come usati dal modulo)
        red: { DEFAULT: '#ef4444', 700: '#b91c1c' },
        green: { DEFAULT: '#22c55e', 700: '#15803d' },
        sky: { DEFAULT: '#0ea5e9', 700: '#0369a1' },
        orange: { DEFAULT: '#f97316', 700: '#c2410c' },
        navy: { DEFAULT: '#1e293b', 300: '#94a3b8' },
        // stop intermedi della scala neutra usati dal chrome del modulo
        neutral: {
          450: '#8f8f8f',
          650: '#4a4a4a',
          750: '#333333',
          850: '#1f1f1f',
        },
      },
      spacing: {
        's-1': '0.25rem',
        's-2': '0.5rem',
        's-3': '0.75rem',
        's-3.5': '0.875rem',
        's-4': '1rem',
        's-5': '1.25rem',
        's-6': '1.5rem',
        's-8': '2rem',
      },
      fontSize: {
        d2: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        h1: ['1.5rem', { lineHeight: '2rem' }],
        h3: ['1.125rem', { lineHeight: '1.5rem' }],
        label: ['0.6875rem', { lineHeight: '1rem' }],
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        pill: '9999px',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
      },
      letterSpacing: {
        brand: '0.1em',
        label: '0.08em',
      },
      boxShadow: {
        'sh-1': '0 1px 2px 0 rgba(0,0,0,0.4)',
        'sh-2': '0 4px 12px -2px rgba(0,0,0,0.5)',
        'sh-3': '0 16px 40px -8px rgba(0,0,0,0.6)',
        'sh-brand': '0 6px 20px -4px rgba(255,176,32,0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
