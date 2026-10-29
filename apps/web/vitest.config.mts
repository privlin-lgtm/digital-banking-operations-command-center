import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // formatDateTime renders in the local timezone (no explicit `timeZone`
    // option) — pinning the test process to UTC keeps its test
    // deterministic across machines/CI instead of depending on whoever
    // runs it being in UTC already.
    env: { TZ: 'UTC' },
  },
});
