import { test, expect } from 'vitest';
import { matchesSearch } from '../../../src/lib/search.js';
test('public metadata search ignores accents and case and requires every word', () => {
  expect(matchesSearch('MAJORITE élise', 'Condition de majorité', 'Élise')).toBe(true);
  expect(matchesSearch('revenu autre', 'Revenu mensuel')).toBe(false);
  expect(matchesSearch('  ', '')).toBe(true);
  expect(matchesSearch('<script>', 'Titre sûr')).toBe(false);
  expect(matchesSearch('abcdef', 'abcdef012345')).toBe(true);
});
