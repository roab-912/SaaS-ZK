import { test, expect, vi } from 'vitest';
import { createNoirRuntime, normalizeInputs } from '../../../zk/noir/runtime.mjs';
import { proofFixture } from '../../helpers/proof.mjs';
import { vatFixture } from '../../helpers/vat.mjs';
import { vatCircuit } from '../../../shared/vat.mjs';
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
      largeVatProverThreads: 4,
      Noir: class {
        execute = execute;
      },
      Backend: class {
        constructor(bytecode, options) {
          expect(options.threads).toBe(1);
        }
        generateProof = generateProof;
        verifyProof = verifyProof;
        destroy = destroy;
      },
      encode: () => envelope.proof,
      decode: () => new Uint8Array(),
    });
    const onProgress = vi.fn();
    const operation = adapter.prove({
      onProgress,
      circuit: envelope.circuit,
      compiled,
      values: { birth: 19900101, cutoff: 20080921 },
    });
    if (failure) await expect(operation).rejects.toThrow();
    else {
      expect(await operation).toEqual(envelope);
      expect(onProgress.mock.calls.map((call) => call[1])).toEqual(['witness', 'prove', 'verify']);
    }
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
    largeVatProverThreads: 4,
    Backend: class {
      constructor(bytecode, options) {
        expect(options.threads).toBe(1);
      }
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

test('only the largest VAT circuit uses the configured prover threads', async () => {
  const { batch, values, envelope } = await vatFixture(1, true);
  const threads = [];
  const runtime = createNoirRuntime({
    largeVatProverThreads: 4,
    Noir: class {
      async execute() {
        return { witness: new Uint8Array(1) };
      }
    },
    Backend: class {
      constructor(bytecode, options) {
        threads.push(options.threads);
      }
      async generateProof() {
        throw Error('end of thread selection test');
      }
      async destroy() {}
    },
  });
  for (const capacity of [250, 500]) {
    await expect(
      runtime.prove({
        circuit: vatCircuit(capacity),
        compiled: { hash: envelope.circuitHash, artifact: { bytecode: 'code' } },
        vatBatch: batch,
        values,
      }),
    ).rejects.toThrow('end of thread selection test');
  }
  expect(threads).toEqual([1, 4]);
});
