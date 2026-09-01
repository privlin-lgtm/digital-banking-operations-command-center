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
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      colors: {
        canvas: '#0b1016',
        panel: '#111820',
        raised: '#161e28',
        ink: '#c5d0dc',
        bright: '#e8eef4',
        muted: '#7d8c9e',
        line: '#1e2a38',
        'line-strong': '#2c3d52',
        accent: {
          DEFAULT: '#3d9eff',
          dim: '#1a4a7a',
        },
        status: {
          critical: '#e03131',
          high: '#f08c00',
          medium: '#e6b325',
          low: '#4c8dff',
          healthy: '#2bb673',
          degraded: '#e6a23c',
          unknown: '#6b7c8f',
          info: '#3d9eff',
        },
        danger: '#e03131',
        warn: '#e6a23c',
      },
      boxShadow: {
        none: 'none',
      },
    },
  },
  plugins: [],
};

export default config;
