import { test, expect } from 'vitest';
import config from '../../vitest.config.mjs';
test('coverage includes all runtime layers with enforced minimums', () => {
  expect(config.test.coverage.thresholds.statements).toBeGreaterThanOrEqual(75);
  expect(config.test.coverage.include.join(' ')).toMatch(/server.*shared.*zk.*src/);
});
