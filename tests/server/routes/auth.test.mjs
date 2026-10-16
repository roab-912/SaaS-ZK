import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
test('registration, duplicate signup, login rotation and logout', async () => {
  const f = await serverFixture();
  try {
    const { cookie } = await f.account();
    expect(
      (
        await f.request('/auth/register', {
          body: { email: 'alice@example.test', password: 'long-password-123' },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await f.request('/auth/login', {
          body: { email: 'alice@example.test', password: 'wrong-password-123' },
        })
      ).status,
    ).toBe(401);
    const login = await f.request('/auth/login', {
      cookie,
      body: { email: 'alice@example.test', password: 'long-password-123' },
    });
    expect(login.status).toBe(200);
    const next = login.headers.get('set-cookie').split(';')[0];
    expect(next).not.toBe(cookie);
    expect((await f.request('/circuits', { cookie })).status).toBe(401);
    await f.request('/auth/logout', { cookie: next, body: {} });
    expect((await f.request('/circuits', { cookie: next })).status).toBe(401);
  } finally {
    await f.close();
  }
});

test('successful login upgrades an original MVP password without resetting the account', async () => {
  const f = await serverFixture();
  try {
    const { user } = await f.account();
    const { scryptSync } = await import('node:crypto');
    const salt = '0123456789abcdef0123456789abcdef',
      old = salt + ':' + scryptSync('legacy-password-123', salt, 64).toString('hex');
    f.db.prepare('UPDATE users SET password=? WHERE id=?').run(old, user.id);
    const response = await f.request('/auth/login', {
      body: { email: user.email, password: 'legacy-password-123' },
    });
    expect(response.status).toBe(200);
    expect(f.db.prepare('SELECT password FROM users WHERE id=?').get(user.id).password).toMatch(
      /^scrypt-v2:/,
    );
  } finally {
    await f.close();
  }
});
