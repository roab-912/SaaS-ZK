import { test, expect, vi } from 'vitest';
import { api } from '../../../src/lib/api.js';
test('API client serializes bodies and handles HTTP and non-JSON failures', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Denied' }) })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw Error('HTML');
      },
    });
  vi.stubGlobal('fetch', fetch);
  expect(await api('/x', { a: 1 })).toEqual({ ok: true });
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: 'POST',
    body: '{"a":1}',
    credentials: 'same-origin',
  });
  await expect(api('/x')).rejects.toThrow('Denied');
  await expect(api('/x')).rejects.toThrow(/invalide/);
  vi.unstubAllGlobals();
});
