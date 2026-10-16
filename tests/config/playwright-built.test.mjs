import { test, expect } from 'vitest';
import config from '../../playwright.built.config.mjs';
test('built browser suite tests packaged files with isolated data', () => {
  expect(config.webServer.command).toContain('--built');
  expect(config.webServer.env.DB_PATH).toBe(':memory:');
});
