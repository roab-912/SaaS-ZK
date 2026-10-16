import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
test('demo billing changes entitlement server-side, with no public activation', async () => {
  const f = await serverFixture();
  try {
    expect((await f.request('/billing/demo', { body: { action: 'activate' } })).status).toBe(401);
    const { cookie } = await f.account();
    expect((await f.request('/billing/demo', { cookie, body: { action: 'unknown' } })).status).toBe(
      400,
    );
    await f.request('/billing/demo', { cookie, body: { action: 'activate' } });
    expect((await (await f.request('/session', { cookie })).json()).user.active).toBe(true);
    await f.request('/billing/demo', { cookie, body: { action: 'cancel' } });
    expect((await (await f.request('/session', { cookie })).json()).user.active).toBe(false);
    expect((await f.request('/billing/webhook', { body: {} })).status).toBe(404);
  } finally {
    await f.close();
  }
});
