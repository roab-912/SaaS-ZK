import { test, expect } from 'vitest';
import config from '../../vitest.offline.config.mjs';
test('portable distribution verification is an explicit integration suite', () => {
  expect(config.test.include).toEqual(['tests/offline-distribution.test.mjs']);
  expect(config.test.testTimeout).toBeGreaterThanOrEqual(180000);
});
