import { test, expect } from 'vitest';
import { serverFixture } from '../../helpers/server.mjs';
import { proofFixture } from '../../helpers/proof.mjs';
import { template } from '../../../shared/circuit.mjs';
test('rejects proof smuggling and unknown engines; archives are isolated', async () => {
  const f = await serverFixture();
  try {
    const { cookie } = await f.account();
    await f.request('/billing/demo', { cookie, body: { action: 'activate' } });
    const envelope = await proofFixture();
    for (const body of [
      { ...envelope, values: { secret: 12 } },
      { ...envelope, engine: 'unknown' },
      { ...envelope, circuitHash: '0'.repeat(64) },
      { ...envelope, publicInputs: [envelope.publicInputs[0], '0x100000000'] },
    ])
      expect((await f.request('/proofs', { cookie, body })).status).toBe(400);
    expect((await f.request('/proofs', { cookie, body: envelope })).status).toBe(201);
    const list = await (await f.request('/proofs', { cookie })).json();
    await f.request('/proofs/' + list[0].id, { cookie, body: {}, method: 'DELETE' });
    expect(await (await f.request('/proofs', { cookie })).json()).toEqual([]);
    expect((await f.request('/compile?engine=untrusted', { body: template() })).status).toBe(400);
    const first = await (await f.request('/circuits', { cookie, body: template() })).json();
    const second = await f.request('/circuits', { cookie, body: template() });
    expect(second.status).toBe(200);
    expect((await second.json()).id).toBe(first.id);
  } finally {
    await f.close();
  }
});

test('circuit engine survives saving and reloading; versions and envelopes cannot mix engines', async () => {
  const { ENGINE, PLONK_ENGINE, FFLONK_ENGINE } = await import('../../../shared/engines.mjs');
  const f = await serverFixture();
  try {
    const { cookie } = await f.account();
    await f.request('/billing/demo', { cookie, body: { action: 'activate' } });
    const ids = [];
    for (const engine of [ENGINE, PLONK_ENGINE, FFLONK_ENGINE]) {
      const response = await f.request('/circuits', { cookie, body: { ...template(), engine } });
      expect(response.status).toBe(201);
      ids.push((await response.json()).id);
    }
    expect(new Set(ids).size).toBe(3);
    const circuits = await (await f.request('/circuits', { cookie })).json();
    expect(new Set(circuits.map((c) => c.schema.engine))).toEqual(
      new Set([ENGINE, PLONK_ENGINE, FFLONK_ENGINE]),
    );
    expect(
      (await f.request('/circuits', { cookie, body: { ...template(), engine: 'untrusted' } }))
        .status,
    ).toBe(400);
    expect(
      (
        await f.request('/compile?engine=' + ENGINE, {
          body: { ...template(), engine: PLONK_ENGINE },
        })
      ).status,
    ).toBe(400);
    const proof = await proofFixture();
    proof.circuit.engine = PLONK_ENGINE;
    expect((await f.request('/proofs', { cookie, body: proof })).status).toBe(400);
  } finally {
    await f.close();
  }
});
