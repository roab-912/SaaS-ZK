import { test, expect } from 'vitest';
import config from '../../eslint.config.mjs';
test('static analysis rejects invalid React hooks and unused values', () => {
  const rules = config.find((c) => c.rules?.['react-hooks/rules-of-hooks']).rules;
  expect(rules['react-hooks/rules-of-hooks']).toBe('error');
  expect(rules['no-unused-vars'][0]).toBe('error');
});
