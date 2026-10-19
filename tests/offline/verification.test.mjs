import { test, expect, vi } from 'vitest';
import { verifyOffline } from '../../offline/verification.mjs';
import { proofFixture } from '../helpers/proof.mjs';
import { createTrustSnapshot } from '../../shared/trust-snapshot.mjs';
import { compileNoir } from '../../zk/noir/compiler.mjs';
vi.mock('../../zk/noir/compiler.mjs', () => ({ compileNoir: vi.fn(async () => ({})) }));
vi.mock('../../zk/operations.mjs', () => ({
  executeZkOperation: vi.fn(async () => ({ valid: true })),
}));
test('offline verifier reconstructs the circuit and returns the proof result independently of validity', async () => {
  const proof = await proofFixture(),
    snapshot = await createTrustSnapshot([], 'https://clair.example');
  const result = await verifyOffline(proof, snapshot);
  expect(result).toMatchObject({
    valid: true,
    result: true,
    circuitHash: proof.circuitHash,
    snapshot: { origin: snapshot.origin },
  });
  expect(compileNoir).toHaveBeenCalledWith(proof.circuit);
  await expect(
    verifyOffline({ ...proof, circuitHash: '0'.repeat(64) }, snapshot),
  ).rejects.toThrow();
});
