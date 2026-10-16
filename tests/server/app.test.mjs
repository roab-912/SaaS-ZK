import { test, expect, vi } from 'vitest';
import { serverFixture } from '../helpers/server.mjs';
test('HTTP composition enforces headers, body limits, origin and safe errors', async () => {
  const logger = { error: vi.fn() },
    f = await serverFixture({
      logger,
      compiler: {
        engines: [],
        compile: async () => {
          throw Error('SECRET DATABASE PATH');
        },
      },
    });
  try {
    const session = await f.request('/session');
    expect(session.headers.get('cache-control')).toBe('no-store');
    expect(session.headers.get('x-powered-by')).toBeNull();
    expect(session.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect((await f.request('/not-found')).status).toBe(404);
    expect((await f.request('/auth/register', { body: '{' })).status).toBe(400);
    expect(
      (await f.request('/auth/register', { body: JSON.stringify('x'.repeat(310000)) })).status,
    ).toBe(413);
    expect((await f.request('/compile', { body: {}, origin: 'https://evil.test' })).status).toBe(
      403,
    );
    const error = await f.request('/compile', { body: {} });
    expect(error.status).toBe(500);
    expect(await error.text()).not.toContain('SECRET');
  } finally {
    await f.close();
  }
});
