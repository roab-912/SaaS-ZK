import { test, expect } from 'vitest';
import { assertSupportedRuntime } from '../../server/runtime-policy.mjs';
const date = new Date('2026-10-30T00:00:00Z');
test('production and portable releases require a supported patched LTS branch', () => {
  for (const v of ['22.23.4', '24.22.2', '26.13.0'])
    expect(() => assertSupportedRuntime(v, date)).not.toThrow();
  for (const v of ['20.20.0', '22.13.0', '24.1.0', '25.4.0', '27.0.0-alpha', 'invalid'])
    expect(() => assertSupportedRuntime(v, date)).toThrow(/LTS/);
  expect(() => assertSupportedRuntime('22.23.4', new Date('2027-04-30'))).toThrow(/LTS/);
});
