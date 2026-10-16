import { test, expect } from 'vitest';
import { date } from '../../../src/lib/format.js';
test('dates are readable in French with the year', () => {
  expect(date('2026-09-21T12:00:00Z')).toMatch(/21.*2026/);
});
