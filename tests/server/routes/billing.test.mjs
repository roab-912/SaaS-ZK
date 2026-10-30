import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
import { template } from '../../../shared/circuit.mjs';
test('registration grants no subscription and the former demo activation route cannot unlock one', async () => {
  const f = await serverFixture();
  try {
    const { user, cookie } = await f.account();
    expect(user).toMatchObject({ active: false, trialActive: false, trialEligible: true });
    expect(
      (await f.request('/billing/demo', { cookie, body: { action: 'activate' } })).status,
    ).toBe(404);
    expect((await f.request('/circuits', { cookie, body: template() })).status).toBe(402);
    expect((await f.request('/prover/authorize', { cookie, body: {} })).status).toBe(402);
    expect((await f.request('/circuits', { cookie })).status).toBe(200);
    expect((await f.request('/issuers')).status).toBe(200);
    const plans = await (await f.request('/billing/plans')).json();
    expect(plans.every((p) => !p.available && p.price === null)).toBe(true);
    expect((await f.request('/billing/webhook', { body: {} })).status).toBe(404);
  } finally {
    await f.close();
  }
});

test('expired trials block creation and finalization while archives and public verification remain accessible', async () => {
  const { proofFixture } = await import('../../helpers/proof.mjs');
  const f = await serverFixture({
    compiler: { engines: [], compile: async () => ({ public: true }) },
  });
  try {
    const { user, cookie } = await f.account();
    f.activate(cookie);
    const proof = await proofFixture();
    // Archive records before the expiration under test.
    const { createRepository } = await import('../../../server/repository.mjs');
    const repo = createRepository(f.db);
    repo.saveProof(user.id, proof);
    repo.saveCircuit(user.id, 'fixture', template());
    const authorization = await (await f.request('/prover/authorize', { cookie, body: {} })).json();
    f.db
      .prepare(
        "UPDATE users SET status='trialing',expires=?,trial_used=1,trial_expires=? WHERE id=?",
      )
      .run(Date.now() - 1, Date.now() + 86400000, user.id);
    const session = await (await f.request('/session', { cookie })).json();
    expect(session.user).toMatchObject({ active: false, trialActive: false, trialEligible: false });
    expect((await f.request('/circuits', { cookie, body: template() })).status).toBe(402);
    expect((await f.request('/proofs', { cookie, body: proof })).status).toBe(402);
    expect((await f.request('/prover/authorize', { cookie, body: {} })).status).toBe(402);
    expect(
      (
        await f.request('/prover/finish', {
          cookie,
          body: { token: authorization.token, complete: true },
        })
      ).status,
    ).toBe(402);
    expect(await (await f.request('/proofs', { cookie })).json()).toHaveLength(1);
    expect(await (await f.request('/circuits', { cookie })).json()).toHaveLength(1);
    expect((await f.request('/compile', { body: template() })).status).toBe(200);
  } finally {
    await f.close();
  }
});

test('all embedded billing operations require authentication, exact origin and strict inputs', async () => {
  const f = await serverFixture();
  try {
    for (const path of ['/billing/config', '/billing/state'])
      expect((await f.request(path)).status).toBe(401);
    for (const path of [
      '/billing/checkout',
      '/billing/payment-method',
      '/billing/complete',
      '/billing/change/preview',
      '/billing/change',
      '/billing/renewal',
    ])
      expect((await f.request(path, { body: {} })).status).toBe(401);
    const { cookie } = await f.account();
    expect(
      (
        await f.request('/billing/change', {
          cookie,
          origin: 'https://evil.test',
          body: { plan: 'pro', token: 'a'.repeat(48) },
        })
      ).status,
    ).toBe(403);
    expect(
      (await f.request('/billing/change', { cookie, body: { plan: 'other', token: 'invalid' } }))
        .status,
    ).toBe(400);
    expect((await f.request('/billing/renewal', { cookie, body: { cancel: 'true' } })).status).toBe(
      400,
    );
    expect((await f.request('/billing/portal', { cookie, body: {} })).status).toBe(404);
    expect(await (await f.request('/billing/config', { cookie })).json()).toMatchObject({
      publishableKey: null,
    });
  } finally {
    await f.close();
  }
});
