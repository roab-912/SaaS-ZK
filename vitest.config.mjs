import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{mjs,js,jsx}'],
    environment: 'node',
    setupFiles: ['./tests/setup.mjs'],
    maxWorkers: 2,
    pool: 'forks',
    testTimeout: 15000,
    hookTimeout: 15000,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['server/**/*.{mjs,js}', 'shared/**/*.mjs', 'zk/**/*.mjs', 'src/**/*.{js,jsx}'],
      exclude: [],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 75, branches: 65, functions: 75, lines: 75 },
    },
  },
});
