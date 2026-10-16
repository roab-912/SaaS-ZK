import { test, expect } from 'vitest';
import config from '../../playwright.config.mjs';
test('browser tests never reuse user database or application server', () => {
  expect(config.webServer.reuseExistingServer).toBe(false);
  expect(config.webServer.env.DB_PATH).toBe(':memory:');
  expect(config.use.baseURL).toBe('http://localhost:3001');
});
