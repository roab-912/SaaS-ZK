import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/visual/{arg}{ext}',
  testMatch: '**/*.spec.mjs',
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    viewport: { width: 1440, height: 1050 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.mjs',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      PORT: '3001',
      APP_URL: 'http://localhost:3001',
      DB_PATH: ':memory:',
      BILLING_MODE: 'demo',
    },
  },
});
