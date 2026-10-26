import { test, expect } from 'vitest';
import { date, displayDate, isoDate } from '../../../src/lib/format.js';
test('display dates use two-digit day and month, including UTC quota boundaries', () => {
  expect(date('2026-09-01T12:00:00Z')).toBe('01/09/2026');
  expect(date('2026-11-01T00:00:00Z', { timeZone: 'UTC' })).toBe('01/11/2026');
});
test('date notation handles compact and ISO dates without changing partial or invalid input', () => {
  expect(displayDate('2000-02-29')).toBe('29/02/2000');
  expect(displayDate(20000229)).toBe('29/02/2000');
  expect(displayDate('29/02/2000')).toBe('29/02/2000');
  expect(displayDate('29/0')).toBe('29/0');
  expect(displayDate(null)).toBe('');
  expect(isoDate('29/02/2000')).toBe('2000-02-29');
  expect(isoDate('31/02/2026')).toBe('2026-02-31');
  expect(isoDate('29/0')).toBe('29/0');
  expect(isoDate('')).toBe('');
});
