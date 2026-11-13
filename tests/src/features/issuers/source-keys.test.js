import { test, expect } from 'vitest';
import {
  generateSourceKeys,
  readSourcePublicKey,
} from '../../../../src/features/issuers/source-keys.js';
import {
  keyFingerprint,
  signInputValue,
  verifySignature,
} from '../../../../shared/attestations.mjs';
import { signVatManifest, verifyVatSignature } from '../../../../shared/vat.mjs';
import { vatFixture } from '../../../helpers/vat.mjs';

test('downloadable source keys sign both existing attestations and VAT manifests', async () => {
  const { publicKey, privateKey } = await generateSourceKeys();
  expect(publicKey).not.toHaveProperty('d');
  expect(privateKey.d).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await readSourcePublicKey(JSON.stringify(publicKey))).toEqual(publicKey);
  const attestation = await signInputValue(
    {
      id: 'income',
      type: 'number',
      source: 'signed',
      visibility: 'public',
      attestation: {
        issuerId: 'new-source',
        claim: 'income_monthly_eur',
        keyHash: await keyFingerprint(publicKey),
      },
    },
    '3000',
    JSON.stringify(privateKey),
  );
  expect(await verifySignature(attestation)).toBe(true);
  const { manifest } = await vatFixture();
  const signed = await signVatManifest(manifest, privateKey, publicKey);
  expect(await verifyVatSignature(signed, publicKey)).toBe(true);
  const other = await generateSourceKeys();
  expect(await verifyVatSignature(signed, other.publicKey)).toBe(false);
});

test('import rejects private keys, invalid curve points, malformed JSON and oversized files', async () => {
  const { publicKey, privateKey } = await generateSourceKeys();
  for (const text of [
    JSON.stringify(privateKey),
    JSON.stringify({ ...publicKey, x: 'A'.repeat(43), y: 'A'.repeat(43) }),
    JSON.stringify({ ...publicKey, crv: 'P-384' }),
    '{invalid',
    ' '.repeat(4097),
  ]) {
    await expect(readSourcePublicKey(text)).rejects.toThrow('clé publique JWK P-256 valide');
  }
});

test('standard public JWK metadata is accepted and excluded from the registry key', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const minimal = await readSourcePublicKey(
    JSON.stringify({ ...exported, alg: 'ES256', use: 'sig', kid: 'external-source' }),
  );
  expect(Object.keys(minimal).sort()).toEqual(['crv', 'kty', 'x', 'y']);
  await expect(
    readSourcePublicKey(JSON.stringify({ ...exported, key_ops: ['sign'] })),
  ).rejects.toThrow('sans clé privée');
});
