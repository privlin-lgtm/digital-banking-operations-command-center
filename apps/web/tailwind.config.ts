import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
        '3xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      colors: {
        canvas: '#0e1218',
        panel: '#151b24',
        raised: '#1b2330',
        ink: '#c2cdd8',
        bright: '#e6edf3',
        muted: '#7d8b99',
        line: '#243041',
        'line-strong': '#314155',
        accent: {
          DEFAULT: '#4c9be8',
          dim: '#1d3f63',
        },
        status: {
          critical: '#e24d4d',
          high: '#e08b2a',
          medium: '#c9a227',
          low: '#4c9be8',
          healthy: '#3aa76d',
          degraded: '#e08b2a',
          unknown: '#6d7b8a',
          info: '#4c9be8',
        },
        danger: '#e24d4d',
        warn: '#e08b2a',
      },
    },
  },
  plugins: [],
};

export default config;
