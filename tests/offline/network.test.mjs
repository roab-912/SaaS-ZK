import { test, expect } from 'vitest';
test('portable execution refuses any attempted remote resource download', async () => {
  const original = globalThis.fetch;
  try {
    const { denyNetwork } = await import('../../offline/network.mjs');
    denyNetwork();
    expect(() => fetch('https://example.test')).toThrow(/réseau interdit/);
  } finally {
    globalThis.fetch = original;
  }
});
