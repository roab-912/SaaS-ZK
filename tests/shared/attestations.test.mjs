import { test, expect } from 'vitest';
import { sign, createPrivateKey, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { signedFixture } from '../helpers/attestation.mjs';
import {
  verifySignature,
  parseAttestation,
  bindEvidence,
  verifyEvidence,
  generateSigningKey,
  keyFingerprint,
  signAttestation,
} from '../../shared/attestations.mjs';
import { validateCircuit, circuitHash } from '../../shared/circuit.mjs';
import { buildProofEnvelope, contextField, parseProof } from '../../shared/proof.mjs';
import { ENGINE } from '../../shared/engines.mjs';
test.each([
  ['number', 3000],
  ['date', '2000-02-29'],
  ['boolean', false],
])('signed %s values bind to the field and the approved key', async (type, value) => {
  const f = await signedFixture(type, value);
  expect(await verifySignature(f.attestation)).toBe(true);
  expect((await verifyEvidence(f.circuit, f.values, f.attestations, f.issuers))[0]).toMatchObject({
    valid: true,
    approved: true,
    signatureValid: true,
    issuerName: 'Source de test',
  });
  expect(validateCircuit(f.circuit)).toEqual(f.circuit);
  await expect(crypto.subtle.exportKey('jwk', f.keys.privateKey)).rejects.toThrow();
});
test('changing any signed field invalidates the signature', async () => {
  const f = await signedFixture();
  for (const patch of [
    { value: 3001 },
    { claim: 'balance_eur' },
    { issuerId: 'another-source' },
    { id: crypto.randomUUID() },
    { type: 'boolean', value: true },
    { expiresAt: new Date(Date.now() + 2 * 86400000).toISOString() },
    { keyHash: '0'.repeat(64) },
    { signature: 'A'.repeat(86) },
  ])
    expect(await verifySignature({ ...f.attestation, ...patch })).toBe(false);
  expect(
    await verifySignature({ ...f.attestation, publicKey: { ...f.keys.publicKey, d: 'secret' } }),
  ).toBe(false);
  expect(() => parseAttestation({ ...f.attestation, approved: true })).toThrow();
});
test('unknown, revoked, replaced, expired and future sources cannot be trusted', async () => {
  const f = await signedFixture();
  for (const issuers of [
    [],
    [{ ...f.issuers[0], approved: false }],
    [{ ...f.issuers[0], jwk: (await generateSigningKey()).publicKey }],
  ])
    expect((await verifyEvidence(f.circuit, f.values, f.attestations, issuers))[0]).toMatchObject({
      valid: false,
      signatureValid: true,
      approved: false,
    });
  for (const now of [Date.parse(f.attestation.issuedAt) - 1, Date.parse(f.attestation.expiresAt)])
    expect(
      (await verifyEvidence(f.circuit, f.values, f.attestations, f.issuers, now))[0],
    ).toMatchObject({ valid: false, current: false });
});
test('missing, duplicated, unrelated evidence and private certification are rejected', async () => {
  const f = await signedFixture();
  for (const evidence of [
    [],
    [...f.attestations, ...f.attestations],
    [{ ...f.attestations[0], inputId: 'other' }],
  ])
    expect(() => bindEvidence(f.circuit, f.values, evidence)).toThrow();
  expect(() => bindEvidence(f.circuit, { income: 4000 }, f.attestations)).toThrow();
  for (const patch of [{ visibility: 'private' }, { attestation: undefined }]) {
    const c = structuredClone(f.circuit);
    Object.assign(c.inputs[0], patch);
    expect(() => validateCircuit(c)).toThrow();
  }
  const old = { ...f.circuit, version: 1 };
  expect(() => validateCircuit(old)).toThrow();
});
test('v3 cannot be downgraded to a declared envelope or stripped of its attestation', async () => {
  const f = await signedFixture(),
    hash = await circuitHash(f.circuit);
  const p = buildProofEnvelope({
    engine: ENGINE,
    circuit: f.circuit,
    circuitHash: hash,
    publicInputs: [contextField(hash), '0x1', '0xbb8'],
    proof: 'AAAA',
    attestations: f.attestations,
  });
  expect(p.format).toBe('clair-proof/3');
  expect(parseProof(p)).toEqual(p);
  const { attestations, ...stripped } = p;
  expect(() => parseProof({ ...stripped, format: 'clair-proof/2' })).toThrow();
  expect(() => parseProof({ ...p, attestations: [] })).toThrow();
  expect(() =>
    parseProof({
      ...p,
      attestations: [
        { inputId: 'income', attestation: { ...attestations[0].attestation, value: 4000 } },
      ],
    }),
  ).toThrow();
});
test('the documented signature encoding interoperates with Node ECDSA', async () => {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
    jwk = pair.publicKey.export({ format: 'jwk' }),
    keyHash = await keyFingerprint(jwk);
  const now = Date.now(),
    p = {
      format: 'clair-attestation/1',
      id: crypto.randomUUID(),
      issuerId: 'source-1',
      keyHash,
      claim: 'amount_eur',
      type: 'number',
      value: 0,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(),
    };
  const bytes = Buffer.from(
    JSON.stringify([
      p.format,
      p.id,
      p.issuerId,
      p.keyHash,
      p.claim,
      p.type,
      p.value,
      p.issuedAt,
      p.expiresAt,
    ]),
  );
  const signature = sign('sha256', bytes, {
    key: pair.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  expect(await verifySignature({ ...p, publicKey: jwk, signature })).toBe(true);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    pair.privateKey.export({ format: 'jwk' }),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const a = await signAttestation(p, privateKey, jwk);
  expect(
    verify(
      'sha256',
      bytes,
      {
        key: createPublicKey(
          createPrivateKey({ key: pair.privateKey.export({ format: 'jwk' }), format: 'jwk' }),
        ),
        dsaEncoding: 'ieee-p1363',
      },
      Buffer.from(a.signature, 'base64url'),
    ),
  ).toBe(true);
});

test('inline field signing rejects wrong keys and signs the exact expected value', async () => {
  const { signInputValue } = await import('../../shared/attestations.mjs');
  const { generateKeyPairSync } = await import('node:crypto');
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
    publicKey = pair.publicKey.export({ format: 'jwk' }),
    privateKey = pair.privateKey.export({ format: 'jwk' });
  const input = {
    id: 'value',
    label: 'Valeur',
    type: 'number',
    source: 'signed',
    visibility: 'public',
    attestation: {
      issuerId: 'source-1',
      keyHash: await keyFingerprint(publicKey),
      claim: 'amount_eur',
    },
  };
  const a = await signInputValue(input, '18', JSON.stringify(privateKey));
  expect(a.value).toBe(18);
  expect(await verifySignature(a)).toBe(true);
  expect(JSON.stringify(a)).not.toContain(privateKey.d);
  const wrong = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
    format: 'jwk',
  });
  await expect(signInputValue(input, '18', JSON.stringify(wrong))).rejects.toThrow(
    'ne correspond pas',
  );
  await expect(signInputValue(input, '18', JSON.stringify(publicKey))).rejects.toThrow(
    'Clé privée',
  );
  for (const value of ['', -1, '1e3', 1.5, 4294967296])
    await expect(signInputValue(input, value, JSON.stringify(privateKey))).rejects.toThrow();
  for (const raw of [
    '{bad',
    'x'.repeat(4097),
    JSON.stringify({ ...privateKey, d: 'A'.repeat(43) }),
  ])
    await expect(signInputValue(input, '18', raw)).rejects.toThrow();
});
