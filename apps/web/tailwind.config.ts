import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#07111c',
        panel: '#0c1a2a',
        ink: '#d7e6f5',
        muted: '#8aa4bd',
        line: '#1c334b',
        accent: {
          DEFAULT: '#3ee0c5',
          dim: '#1a6f64',
        },
        danger: '#ff6b7a',
        warn: '#f5c14a',
      },
      boxShadow: {
        panel: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
