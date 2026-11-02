import { test, expect, vi } from 'vitest';
import { serverFixture } from './helpers/server.mjs';
test('encoded request bodies are rejected before decompression and the server remains available', async () => {
  const f = await serverFixture();
  try {
    for (const encoding of ['gzip', 'deflate', 'br']) {
      const r = await f.request('/auth/register', {
        body: 'invalid compressed payload',
        headers: { 'content-encoding': encoding },
      });
      expect(r.status).toBe(415);
      expect((await r.json()).error).toMatch(/compressées/);
    }
    expect((await f.request('/session')).status).toBe(200);
  } finally {
    await f.close();
  }
});
test('revoking sessions invalidates every device for that account without touching another account', async () => {
  const logger = { info: vi.fn(), error: vi.fn() },
    f = await serverFixture({ logger });
  try {
    const a = await f.account(),
      b = await f.account('other@example.test');
    const r = await f.request('/auth/login', {
      body: { email: a.user.email, password: 'long-password-123' },
    });
    const second = r.headers.get('set-cookie').split(';')[0];
    expect((await f.request('/circuits', { cookie: a.cookie })).status).toBe(200);
    expect(
      (
        await f.request('/auth/logout-all', {
          cookie: a.cookie,
          origin: 'https://evil.test',
          body: {},
        })
      ).status,
    ).toBe(403);
    expect((await f.request('/auth/logout-all', { cookie: a.cookie, body: {} })).status).toBe(200);
    for (const cookie of [a.cookie, second])
      expect((await f.request('/circuits', { cookie })).status).toBe(401);
    expect((await f.request('/circuits', { cookie: b.cookie })).status).toBe(200);
    expect(
      logger.info.mock.calls.some(
        ([r]) => r.action === 'auth.revoke_sessions' && r.actorId === a.user.id,
      ),
    ).toBe(true);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('long-password');
  } finally {
    await f.close();
  }
});
test('failed account login attempts are bounded independently of successful requests', async () => {
  const f = await serverFixture();
  try {
    const { user } = await f.account();
    for (let i = 0; i < 10; i++)
      expect(
        (
          await f.request('/auth/login', {
            body: { email: user.email, password: 'wrong-password-123' },
          })
        ).status,
      ).toBe(401);
    expect(
      (
        await f.request('/auth/login', {
          body: { email: user.email.toUpperCase(), password: 'wrong-password-123' },
        })
      ).status,
    ).toBe(429);
  } finally {
    await f.close();
  }
});
