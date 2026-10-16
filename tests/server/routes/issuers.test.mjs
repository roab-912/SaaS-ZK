import { test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { serverFixture } from '../../helpers/server.mjs';
test('only approved account IDs can add and revoke validated public keys', async () => {
  const f = await serverFixture({ env: { BILLING_MODE: 'demo', ADMIN_USER_IDS: 'admin' } });
  try {
    const a = await f.account();
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const body = {
      id: 'issuer',
      name: 'Issuer',
      jwk: publicKey.export({ format: 'jwk' }),
      approved: true,
    };
    expect((await f.request('/issuers', { cookie: a.cookie, body })).status).toBe(403);
    // Set a known ID without changing the role model or relying on email.
    f.db
      .prepare('INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)')
      .run(
        'admin',
        'admin@example.test',
        f.db.prepare('SELECT password FROM users WHERE id=?').get(a.user.id).password,
        'now',
      );
    const login = await f.request('/auth/login', {
        body: { email: 'admin@example.test', password: 'long-password-123' },
      }),
      cookie = login.headers.get('set-cookie').split(';')[0];
    expect((await f.request('/issuers', { cookie, body })).status).toBe(200);
    expect(await (await f.request('/issuers')).json()).toHaveLength(1);
    await f.request('/issuers', { cookie, body: { ...body, approved: false } });
    expect(await (await f.request('/issuers')).json()).toEqual([]);
  } finally {
    await f.close();
  }
});
