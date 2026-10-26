import { test, expect, vi } from 'vitest';
import { api } from '../../../src/lib/api.js';
test('API client serializes bodies and handles HTTP and non-JSON failures', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-Clair-Protocol': '5' }),
      json: async () => ({ ok: true }),
    })
    .mockResolvedValueOnce({
      ok: false,
      headers: new Headers({ 'X-Clair-Protocol': '5' }),
      json: async () => ({ error: 'Denied' }),
    })
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

test('stale servers explain how to restart instead of returning vague validation errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      headers: new Headers(),
      json: async () => ({ error: 'Données invalides.' }),
    })),
  );
  try {
    await expect(api('/circuits', {})).rejects.toThrow('demarrer.cmd');
  } finally {
    vi.unstubAllGlobals();
  }
});
