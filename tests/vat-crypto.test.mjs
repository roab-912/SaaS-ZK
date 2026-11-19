import { test, expect } from 'vitest';
import { vatFixture } from './helpers/vat.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { createNoirRuntime } from '../zk/noir/runtime.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { executeZkOperation } from '../zk/operations.mjs';

// Optional local copy of the public CRS for offline or restricted-network test runs.
class TestBackend extends UltraHonkBackend {
  constructor(bytecode, options) {
    super(bytecode, { ...options, crsPath: process.env.CLAIR_TEST_CRS_PATH });
  }
}
test(
  '500 certified invoices produce a real private proof, and invalid or revoked signatures invalidate it',
  { timeout: 600000 },
  async () => {
    const f = await vatFixture(500, true),
      compiled = await compileNoir(f.circuit);
    const registry = createEngineRegistry(
      [
        createNoirRuntime({
          Noir,
          Backend: TestBackend,
          encode: (bytes) => Buffer.from(bytes).toString('base64'),
          decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
        }),
      ],
      ['prove', 'verify'],
    );
    const proof = await executeZkOperation(
      {
        mode: 'prove',
        circuit: f.circuit,
        compiled,
        values: f.values,
        vatBatch: f.batch,
        issuers: f.issuers,
      },
      registry,
      process.env.CLAIR_TEST_PROGRESS
        ? (message) => console.log(new Date().toISOString(), message)
        : undefined,
    );
    expect(proof.circuit.vat.programVersion).toBe(2);
    expect(
      (
        await executeZkOperation(
          { mode: 'verify', envelope: proof, compiled, issuers: f.issuers },
          registry,
        )
      ).valid,
    ).toBe(true);
    const encoded = JSON.stringify(proof);
    expect(encoded).not.toContain('FA-000001');
    expect(encoded).not.toContain('netCents');
    expect(encoded).not.toContain(f.batch.blinding);
    const changedTotal = structuredClone(proof);
    changedTotal.publicInputs[5] = '0x' + (BigInt(changedTotal.publicInputs[5]) + 1n).toString(16);
    changedTotal.publicData.find((i) => i.id === 'sales_vat').value++;
    expect(
      (
        await executeZkOperation(
          { mode: 'verify', envelope: changedTotal, compiled, issuers: f.issuers },
          registry,
        )
      ).valid,
    ).toBe(false);
    const altered = structuredClone(proof);
    altered.vatManifest.signature = 'A'.repeat(86);
    const result = await executeZkOperation(
      { mode: 'verify', envelope: altered, compiled, issuers: f.issuers },
      registry,
    );
    expect(result.proofValid).toBe(true);
    expect(result.valid).toBe(false);
    expect(
      (
        await executeZkOperation(
          { mode: 'verify', envelope: proof, compiled, issuers: [] },
          registry,
        )
      ).valid,
    ).toBe(false);
  },
);
