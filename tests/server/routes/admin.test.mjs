import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
test('administrator statistics require an explicit account ID and exclude expired access', async () => {
  const f = await serverFixture();
  try {
    const { user, cookie } = await f.account();
    expect((await f.request('/admin/dashboard')).status).toBe(401);
    expect((await f.request('/admin/dashboard', { cookie })).status).toBe(403);
    const admin = await serverFixture({ env: { ADMIN_USER_IDS: user.id } });
    try {
      admin.db
        .prepare(
          'INSERT INTO users(id,email,password,created,status,expires,plan) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          user.id,
          'admin@test.fr',
          'private-digest',
          'today',
          'active',
          Date.now() + 60000,
          'pro',
        );
      admin.db.prepare("UPDATE users SET subscription='sub_fixture' WHERE id=?").run(user.id);
      // Store only the digest of the test session token, as production does.
      const { createHash } = await import('node:crypto');
      const token = 'b'.repeat(64),
        digest = createHash('sha256').update(token).digest('hex');
      admin.db
        .prepare('INSERT INTO sessions VALUES(?,?,?)')
        .run(digest, user.id, Date.now() + 60000);
      admin.db
        .prepare('INSERT INTO users(id,email,password,created,status,expires) VALUES(?,?,?,?,?,?)')
        .run('expired', 'old@test.fr', 'secret', 'today', 'active', 1);
      const response = await admin.request('/admin/dashboard', {
        cookie: 'clair_session=' + token,
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toMatchObject({
        users: 2,
        activeSubscriptions: 1,
        circuits: 0,
        proofs: 0,
        subscriptions: [{ plan: 'pro', count: 1 }],
      });
      expect(JSON.stringify(result)).not.toMatch(/private-digest|admin@test.fr|clair_session/);
    } finally {
      await admin.close();
    }
  } finally {
    await f.close();
  }
});
