/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Base gray ──────────────────────────────────────────────
        // Blue-tinted slate is replaced with a true-neutral ramp tuned
        // for a black UI. Light mode stays paper-neutral, dark mode is
        // near-black with subtle stepped surfaces:
        //   page (950: #09090B) < cards/header (900: #131316) < raised (800: #27272A)
        slate: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#131316',
          950: '#09090B',
        },
        // ── Action: deep emerald ───────────────────────────────────
        // Every existing `indigo-*` class becomes emerald instead of
        // AI-looking purple. 600/700 are mode-aware (deep emerald button
        // in light mode, bright emerald button in dark mode — see
        // index.css `--accent` plus the `.dark .bg-indigo-600` label fix).
        // Fixed steps: 50–200 soft surfaces, 300/400 dark-mode accents,
        // 500 rings/borders visible on both modes, 800–950 deep greens.
        indigo: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#059669',
          600: 'rgb(var(--accent) / <alpha-value>)',
          700: 'rgb(var(--accent-hover) / <alpha-value>)',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        // ── Neutralized cool accents ───────────────────────────────
        // Remaining purple/blue/sky usages (badges, AI-assistant bubbles)
        // map to the same gray ramp so nothing glows violet/blue.
        purple: {
          50: '#F4F4F5',
          100: '#E9E9EC',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#E4E4E7',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#3F3F46',
          900: '#27272A',
          950: '#131316',
        },
        blue: {
          50: '#F4F4F5',
          100: '#E9E9EC',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#E4E4E7',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#3F3F46',
          900: '#27272A',
          950: '#131316',
        },
        sky: {
          50: '#F4F4F5',
          100: '#E9E9EC',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#E4E4E7',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#3F3F46',
          900: '#27272A',
          950: '#131316',
        },
        // ── Semantic (kept, de-neoned to sit on black) ─────────────
        difficulty: {
          easy: '#16A34A',
          medium: '#D97706',
          hard: '#DC2626',
        },
        verdict: {
          pass: '#16A34A',
          revise: '#D97706',
          unreviewed: '#71717A',
        },
        // ── Explicit black-UI tokens for new code ──────────────────
        // Mode-aware via index.css vars, e.g. `bg-canvas bg-surface
        // text-ink border-line`.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        // Flat, subtle shadows — no colored glow.
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
