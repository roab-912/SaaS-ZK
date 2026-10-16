import { test, expect } from 'vitest';
import { compileCircom } from '../../../zk/circom/compiler.mjs';
import { circomBrowsers } from '../../../zk/circom/browser.mjs';
import { template, circuitHash } from '../../../shared/circuit.mjs';
import { PLONK_ENGINE, FFLONK_ENGINE } from '../../../shared/engines.mjs';
test.each([PLONK_ENGINE, FFLONK_ENGINE])(
  'real %s proof binds circuit, public values and randomized proof',
  { timeout: 180000 },
  async (engine) => {
    const circuit = { ...template(), engine },
      compiled = await compileCircom(circuit, engine);
    expect(compiled.hash).toBe(await circuitHash(circuit));
    expect(compiled.artifact.vk.nPublic).toBe(2);
    const adapter = circomBrowsers.find((a) => a.id === engine);
    const values = { birth: '1991-07-14', cutoff: '2008-09-21' };
    const envelope = await adapter.prove({ circuit, compiled, values });
    const second = await adapter.prove({ circuit, compiled, values });
    expect(envelope.proof).not.toBe(second.proof);
    expect(await adapter.verify({ envelope, compiled })).toEqual({ valid: true });
    expect(await adapter.verify({ envelope: second, compiled })).toEqual({ valid: true });
    for (const field of [0, 1]) {
      const changed = structuredClone(envelope);
      changed.publicInputs[field] = '0x' + (BigInt(changed.publicInputs[field]) + 1n).toString(16);
      expect(await adapter.verify({ envelope: changed, compiled })).toEqual({ valid: false });
    }
    const proof = JSON.parse(Buffer.from(envelope.proof, 'base64').toString());
    if (proof.evaluations) proof.evaluations.a = '0';
    else proof.eval_a = '0';
    const altered = { ...envelope, proof: Buffer.from(JSON.stringify(proof)).toString('base64') };
    expect(await adapter.verify({ envelope: altered, compiled })).toEqual({ valid: false });
    await expect(
      adapter.prove({ circuit, compiled, values: { ...values, birth: '2015-01-01' } }),
    ).rejects.toThrow();
    // Reconstructing from the public circuit and universal parameters preserves the key.
    const rebuilt = await compileCircom(circuit, engine);
    expect(rebuilt.artifact.vk).toEqual(compiled.artifact.vk);
    expect(await adapter.verify({ envelope, compiled: rebuilt })).toEqual({ valid: true });
  },
);
test('compiler rejects unregistered protocols and invalid circuits before preparation', async () => {
  await expect(compileCircom(template(), 'unknown')).rejects.toThrow();
  await expect(compileCircom({}, PLONK_ENGINE)).rejects.toThrow();
});
