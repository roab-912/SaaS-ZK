import { test, expect } from 'vitest';
import { createTrustSnapshot, validateTrustSnapshot } from '../../shared/trust-snapshot.mjs';
import { signedFixture } from '../helpers/attestation.mjs';
test('snapshot exports only approved public keys and detects corruption and duplicate IDs', async () => {
  const f = await signedFixture(),
    source = f.issuers[0];
  const snapshot = await createTrustSnapshot(
    [
      { ...source, secret: 'not exported' },
      { ...source, id: 'revoked', approved: false },
    ],
    'https://clair.example',
    0,
  );
  expect(snapshot.exportedAt).toBe('1970-01-01T00:00:00.000Z');
  expect(snapshot.issuers).toHaveLength(1);
  expect(snapshot.issuers[0].secret).toBeUndefined();
  expect(await validateTrustSnapshot(snapshot)).toEqual(snapshot);
  await expect(
    validateTrustSnapshot({ ...snapshot, issuers: [snapshot.issuers[0], snapshot.issuers[0]] }),
  ).rejects.toThrow(/dupliquées/);
  await expect(
    validateTrustSnapshot({
      ...snapshot,
      issuers: [{ ...snapshot.issuers[0], keyHash: '0'.repeat(64) }],
    }),
  ).rejects.toThrow(/Empreinte/);
  await expect(validateTrustSnapshot({ ...snapshot, privateKey: {} })).rejects.toThrow();
});
