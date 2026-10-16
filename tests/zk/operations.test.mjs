import { test, expect, vi } from 'vitest';
import { executeZkOperation } from '../../zk/operations.mjs';
import { createEngineRegistry } from '../../zk/registry.mjs';
import { proofFixture } from '../helpers/proof.mjs';
test('adding another provider needs no changes to dispatch and verifies engine/hash bindings', async () => {
  const envelope = await proofFixture();
  envelope.engine = 'second-engine';
  const adapter = {
      id: 'second-engine',
      prove: vi.fn(async () => envelope),
      verify: vi.fn(async () => ({ valid: true })),
    },
    registry = createEngineRegistry([adapter], ['prove', 'verify']);
  const compiled = { engine: adapter.id, hash: envelope.circuitHash, artifact: {} };
  await expect(
    executeZkOperation(
      { mode: 'prove', engine: adapter.id, circuit: envelope.circuit, compiled, values: {} },
      registry,
    ),
  ).resolves.toEqual(envelope);
  await expect(
    executeZkOperation({ mode: 'verify', envelope, compiled }, registry),
  ).resolves.toEqual({ valid: true });
  expect(adapter.verify).toHaveBeenCalledOnce();
  await expect(
    executeZkOperation(
      { mode: 'verify', envelope, compiled: { ...compiled, engine: 'wrong' } },
      registry,
    ),
  ).rejects.toThrow();
  await expect(executeZkOperation({ mode: 'unknown' }, registry)).rejects.toThrow();
  await expect(
    executeZkOperation(
      { mode: 'verify', envelope: { ...envelope, circuitHash: '0'.repeat(64) }, compiled },
      registry,
    ),
  ).rejects.toThrow();
});
