import { test, expect } from 'vitest';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { compileNoir } from '../../../zk/noir/compiler.mjs';
import { createNoirRuntime, normalizeInputs } from '../../../zk/noir/runtime.mjs';
import {
  privateSignatureSource,
  privateSignatureWitness,
} from '../../../zk/noir/private-signatures.mjs';
import { contextField, parseProof } from '../../../shared/proof.mjs';
import { privateFixture } from '../../helpers/private-attestation.mjs';
import { executeZkOperation } from '../../../zk/operations.mjs';
import { createEngineRegistry } from '../../../zk/registry.mjs';
test('real ZK proof verifies a hidden P-256 signature; witness attacks and public-date tampering fail', async () => {
  const f = await privateFixture(),
    compiled = await compileNoir(f.circuit);
  expect(privateSignatureSource(f.circuit).checks.join('')).toContain('sha256_compression');
  const witnessInputs = {
    context: contextField(compiled.hash),
    result: true,
    ...normalizeInputs(f.circuit, f.values),
    ...privateSignatureWitness(f.circuit, f.attestations),
  };
  const noir = new Noir(compiled.artifact);
  for (const patch of [
    { in_0: '3456790' },
    { sig_0: [...witnessInputs.sig_0].map(() => 0) },
    { sig_0_expires: String(Date.now() + 10000) },
    { sig_0_id: Array(16).fill(0) },
  ])
    await expect(noir.execute({ ...witnessInputs, ...patch })).rejects.toThrow();
  const adapter = createNoirRuntime({
    Noir,
    Backend: UltraHonkBackend,
    encode: (b) => Buffer.from(b).toString('base64'),
    decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
  });
  const registry = createEngineRegistry([adapter], ['prove', 'verify']);
  const envelope = await executeZkOperation(
    {
      mode: 'prove',
      engine: f.circuit.engine,
      circuit: f.circuit,
      values: f.values,
      attestations: f.attestations,
      issuers: f.issuers,
      compiled,
    },
    registry,
  );
  expect(envelope.format).toBe('clair-proof/4');
  expect(envelope.publicData).toEqual([]);
  expect(envelope.attestations).toEqual([]);
  expect(envelope.publicInputs).toHaveLength(4);
  const text = JSON.stringify(envelope);
  for (const secret of [String(f.values.income), f.attestation.signature, f.attestation.id])
    expect(text).not.toContain(secret);
  expect(envelope.privateAttestations[0]).toEqual({
    inputId: 'income',
    issuedAt: f.attestation.issuedAt,
    expiresAt: f.attestation.expiresAt,
  });
  const verify = (issuers) =>
    executeZkOperation({ mode: 'verify', envelope, compiled, issuers }, registry);
  expect((await verify(f.issuers)).valid).toBe(true);
  expect((await verify([])).valid).toBe(false);
  const changed = structuredClone(envelope);
  changed.privateAttestations[0].expiresAt = new Date(Date.now() + 10000).toISOString();
  expect(() => parseProof(changed)).toThrow(/Dates/);
  changed.publicInputs[3] =
    '0x' + Date.parse(changed.privateAttestations[0].expiresAt).toString(16);
  expect(
    (
      await executeZkOperation(
        { mode: 'verify', envelope: changed, compiled, issuers: f.issuers },
        registry,
      )
    ).valid,
  ).toBe(false);
}, 180000);

test.each([
  ['date', '1990-06-15'],
  ['boolean', false],
])(
  'Noir constrains the signed private %s encoding',
  async (type, value) => {
    const f = await privateFixture(type, value),
      compiled = await compileNoir(f.circuit);
    const inputs = {
      context: contextField(compiled.hash),
      result: type === 'date',
      ...normalizeInputs(f.circuit, f.values),
      ...privateSignatureWitness(f.circuit, f.attestations),
    };
    const noir = new Noir(compiled.artifact);
    const { witness } = await noir.execute(inputs);
    witness.fill(0);
    await expect(
      noir.execute({ ...inputs, in_0: type === 'date' ? '19900616' : true }),
    ).rejects.toThrow();
  },
  30000,
);
