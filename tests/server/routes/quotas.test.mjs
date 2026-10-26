import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
import { createRepository } from '../../../server/repository.mjs';
import { monthWindow } from '../../../server/plans.mjs';
import { template } from '../../../shared/circuit.mjs';
test('paid API applies storage and generation limits, deduplicates circuits and isolates reservations', async () => {
  const f = await serverFixture();
  try {
    const a = await f.account(),
      b = await f.account('bob@example.test'),
      repo = createRepository(f.db);
    expect(a.user.active).toBe(false);
    f.activate(a.cookie);
    for (let i = 0; i < 9; i++) repo.saveCircuit(a.user.id, 'seed' + i, {});
    const responses = await Promise.all(
      [0, 1, 2].map((i) =>
        f.request('/circuits', { cookie: a.cookie, body: { ...template(), name: 'Circuit ' + i } }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const kept = repo.listCircuits(a.user.id).find((c) => c.hash !== 'seed' && c.schema.name);
    expect((await f.request('/circuits', { cookie: a.cookie, body: kept.schema })).status).toBe(
      200,
    );
    const now = Date.now(),
      period = monthWindow(now).period;
    for (let i = 0; i < 99; i++) {
      const r = repo.reserveProof(a.user.id, period, now, 100);
      repo.finishProof(a.user.id, r.token, true, now);
    }
    const reserve = await Promise.all(
      [0, 1, 2].map(() => f.request('/prover/authorize', { cookie: a.cookie, body: {} })),
    );
    expect(reserve.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    f.activate(b.cookie);
    const token = (await reserve.find((r) => r.status === 200).json()).token;
    expect(
      (await f.request('/prover/finish', { cookie: b.cookie, body: { token, complete: true } }))
        .status,
    ).toBe(409);
    expect(
      (await f.request('/prover/finish', { cookie: a.cookie, body: { token, complete: false } }))
        .status,
    ).toBe(200);
    const next = await (
      await f.request('/prover/authorize', { cookie: a.cookie, body: {} })
    ).json();
    for (let i = 0; i < 2; i++)
      expect(
        (
          await f.request('/prover/finish', {
            cookie: a.cookie,
            body: { token: next.token, complete: true },
          })
        ).status,
      ).toBe(200);
    const session = await (await f.request('/session', { cookie: a.cookie })).json();
    expect(session.usage).toMatchObject({
      circuits: 10,
      generations: 100,
      pending: 0,
      limits: { generations: 100 },
    });
    expect((await f.request('/prover/authorize', { cookie: a.cookie, body: {} })).status).toBe(409);
    // Simulate a paid upgrade independently of the Essential-only trial.
    f.activate(a.cookie, 'pro');
    expect((await f.request('/prover/authorize', { cookie: a.cookie, body: {} })).status).toBe(200);
    expect(
      (
        await f.request('/circuits', {
          cookie: a.cookie,
          body: { ...template(), name: 'Pro circuit' },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await f.request('/billing/demo', {
          cookie: a.cookie,
          body: { action: 'activate', plan: 'unlimited' },
        })
      ).status,
    ).toBe(404);
  } finally {
    await f.close();
  }
});
