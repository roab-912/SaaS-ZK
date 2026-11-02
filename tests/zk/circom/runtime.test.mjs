import { test, expect, vi } from 'vitest';
import { createCircomRuntime } from '../../../zk/circom/runtime.mjs';
import { PLONK_ENGINE } from '../../../shared/engines.mjs';
import { template, circuitHash, contextField } from '../../../shared/circuit.mjs';
test('runtime isolates private witnesses, enforces protocol and disposes on success or failure', async () => {
  const circuit = { ...template(), engine: PLONK_ENGINE },
    hash = await circuitHash(circuit);
  const witness = new Uint8Array([1, 2, 3]);
  const proof = { protocol: 'plonk', curve: 'bn128' };
  const sdk = {
    wtns: {
      calculate: vi.fn(async (input, wasm, target) => {
        target.data = witness;
      }),
    },
    plonk: {
      prove: vi.fn(async () => ({
        proof,
        publicSignals: [BigInt(contextField(hash)).toString(), '20080921'],
      })),
      verify: vi.fn(async () => true),
    },
  };
  const dispose = vi.fn();
  const adapter = createCircomRuntime({
    id: PLONK_ENGINE,
    protocol: 'plonk',
    loadSdk: async () => sdk,
    dispose,
    encode: (bytes) => Buffer.from(bytes).toString('base64'),
    decode: (text) => new Uint8Array(Buffer.from(text, 'base64')),
  });
  const compiled = {
    hash,
    artifact: { protocol: 'plonk', vk: { protocol: 'plonk' }, wasm: 'AA==', zkey: 'AA==' },
  };
  const onProgress = vi.fn();
  const envelope = await adapter.prove({
    onProgress,
    circuit,
    compiled,
    values: { birth: '1991-07-14', cutoff: '2008-09-21' },
  });
  expect(onProgress.mock.calls.map((call) => call[1])).toEqual(['witness', 'prove', 'verify']);
  expect(envelope.engine).toBe(PLONK_ENGINE);
  expect(witness).toEqual(new Uint8Array(3));
  expect(dispose).toHaveBeenCalledOnce();
  expect(JSON.stringify(envelope)).not.toContain('19910714');
  expect(await adapter.verify({ envelope, compiled })).toEqual({ valid: true });
  const other = {
    ...envelope,
    proof: Buffer.from(JSON.stringify({ ...proof, protocol: 'fflonk' })).toString('base64'),
  };
  expect(await adapter.verify({ envelope: other, compiled })).toEqual({ valid: false });
  sdk.plonk.prove.mockRejectedValueOnce(Error('private witness'));
  witness.fill(9);
  await expect(
    adapter.prove({ circuit, compiled, values: { birth: '1991-07-14', cutoff: '2008-09-21' } }),
  ).rejects.toThrow();
  expect(witness).toEqual(new Uint8Array(3));
  expect(dispose).toHaveBeenCalledTimes(4);
  await expect(
    adapter.verify({ envelope, compiled: { ...compiled, artifact: { protocol: 'fflonk' } } }),
  ).rejects.toThrow();
  sdk.plonk.verify.mockResolvedValueOnce(false);
  await expect(
    adapter.prove({ circuit, compiled, values: { birth: '1991-07-14', cutoff: '2008-09-21' } }),
  ).rejects.toThrow(/incorrecte/);
});
