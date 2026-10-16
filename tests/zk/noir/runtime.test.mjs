import { test, expect, vi } from 'vitest';
import { createNoirRuntime, normalizeInputs } from '../../../zk/noir/runtime.mjs';
import { proofFixture } from '../../helpers/proof.mjs';
test('adapter always enables ZK and wipes witness on success and every failure', async () => {
  const envelope = await proofFixture(),
    compiled = { hash: envelope.circuitHash, artifact: { bytecode: 'code' } };
  for (const failure of [null, 'generate', 'verify', 'execute']) {
    const witness = new Uint8Array([11, 22, 33]),
      destroy = vi.fn();
    const execute = vi.fn(async () => {
      if (failure === 'execute') throw Error('secret');
      return { witness };
    });
    const generateProof = vi.fn(async () => {
      if (failure === 'generate') throw Error('secret');
      return { proof: new Uint8Array([0, 0, 0]), publicInputs: envelope.publicInputs };
    });
    const verifyProof = vi.fn(async () => failure !== 'verify');
    const adapter = createNoirRuntime({
      Noir: class {
        execute = execute;
      },
      Backend: class {
        generateProof = generateProof;
        verifyProof = verifyProof;
        destroy = destroy;
      },
      encode: () => envelope.proof,
      decode: () => new Uint8Array(),
    });
    const operation = adapter.prove({
      circuit: envelope.circuit,
      compiled,
      values: { birth: 19900101, cutoff: 20080921 },
    });
    if (failure) await expect(operation).rejects.toThrow();
    else expect(await operation).toEqual(envelope);
    if (failure !== 'execute') {
      expect([...witness]).toEqual([0, 0, 0]);
      expect(destroy).toHaveBeenCalledOnce();
      expect(generateProof.mock.calls[0][1]).toEqual({ keccakZK: true });
    }
  }
  expect(normalizeInputs(envelope.circuit, { birth: 19900101, cutoff: 20080921 })).toEqual({
    in_0: '19900101',
    in_1: '20080921',
  });
});
test('verification releases backend even when provider verification throws', async () => {
  const destroy = vi.fn(),
    proof = await proofFixture();
  const adapter = createNoirRuntime({
    Backend: class {
      verifyProof = vi.fn(async () => {
        throw Error('bad proof');
      });
      destroy = destroy;
    },
    decode: () => new Uint8Array(),
  });
  await expect(
    adapter.verify({ envelope: proof, compiled: { artifact: { bytecode: 'x' } } }),
  ).rejects.toThrow('bad proof');
  expect(destroy).toHaveBeenCalledOnce();
});
