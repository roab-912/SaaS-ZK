import { test, expect } from 'vitest';
import { privateFixture } from '../helpers/private-attestation.mjs';
import { privateMessage, privatePrefix, uuidBytes } from '../../shared/private-attestations.mjs';
import { verifySignature, bindEvidence, verifyPrivateSources } from '../../shared/attestations.mjs';
import { validateCircuit } from '../../shared/circuit-schema.mjs';
import { PLONK_ENGINE, FFLONK_ENGINE } from '../../shared/engines.mjs';
test.each([
  ['number', 3456789],
  ['date', '1990-06-15'],
  ['boolean', true],
])('private %s attestation signs typed value, policy and validity', async (type, value) => {
  const f = await privateFixture(type, value);
  expect(privateMessage(f.attestation)).toHaveLength(189);
  expect(privatePrefix(f.circuit.inputs[0])).toHaveLength(153);
  expect(uuidBytes(f.attestation.id)).toHaveLength(16);
  expect(await verifySignature(f.attestation)).toBe(true);
  for (const patch of [
    { value: type === 'number' ? 3001 : type === 'date' ? '1991-06-15' : false },
    { claim: 'other' },
    { expiresAt: new Date(Date.now() + 10000).toISOString() },
    { id: crypto.randomUUID() },
  ])
    expect(await verifySignature({ ...f.attestation, ...patch })).toBe(false);
  expect(bindEvidence(f.circuit, f.values, f.attestations)).toHaveLength(1);
  expect(validateCircuit(f.circuit)).toEqual(f.circuit);
  for (const engine of [PLONK_ENGINE, FFLONK_ENGINE])
    expect(() => validateCircuit({ ...f.circuit, engine })).toThrow(/Noir/);
  const rows = [
    { inputId: 'income', issuedAt: f.attestation.issuedAt, expiresAt: f.attestation.expiresAt },
  ];
  expect((await verifyPrivateSources(f.circuit, rows, f.issuers))[0].valid).toBe(true);
  expect((await verifyPrivateSources(f.circuit, rows, []))[0].valid).toBe(false);
  expect(
    (await verifyPrivateSources(f.circuit, rows, f.issuers, Date.now() + 8 * 86400000))[0].current,
  ).toBe(false);
});

test('mixed public/private evidence is projected without leaking private attestations', async () => {
  const { signedFixture } = await import('../helpers/attestation.mjs');
  const { circuitHash } = await import('../../shared/circuit-model.mjs');
  const { buildProofEnvelope, parseProof, contextField } = await import('../../shared/proof.mjs');
  const f = await privateFixture(),
    p = await signedFixture();
  const pub = { ...p.circuit.inputs[0], id: 'public_income' };
  f.circuit.inputs.push(pub);
  f.circuit.root = {
    kind: 'op',
    op: 'and',
    args: [
      f.circuit.root,
      {
        kind: 'op',
        op: 'gte',
        args: [
          { kind: 'input', id: pub.id },
          { kind: 'constant', type: 'number', value: 0 },
        ],
      },
    ],
  };
  const hash = await circuitHash(f.circuit);
  const raw = {
    engine: f.circuit.engine,
    circuit: f.circuit,
    circuitHash: hash,
    proof: 'AAAA',
    publicInputs: [
      contextField(hash),
      '0x1',
      '0xbb8',
      '0x' + Date.parse(f.attestation.issuedAt).toString(16),
      '0x' + Date.parse(f.attestation.expiresAt).toString(16),
    ],
    attestations: [...f.attestations, { inputId: pub.id, attestation: p.attestation }],
  };
  const envelope = buildProofEnvelope(raw);
  expect(envelope.attestations).toEqual([{ inputId: pub.id, attestation: p.attestation }]);
  expect(envelope.publicData[0].value).toBe(3000);
  expect(JSON.stringify(envelope)).not.toContain(f.attestation.signature);
  expect(() =>
    parseProof({
      ...envelope,
      privateAttestations: [{ ...envelope.privateAttestations[0], value: f.values.income }],
    }),
  ).toThrow();
  expect(() => parseProof({ ...envelope, attestations: raw.attestations })).toThrow();
  expect(() => parseProof({ ...envelope, format: 'clair-proof/3' })).toThrow();
});
