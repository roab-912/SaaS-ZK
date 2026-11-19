import { test, expect } from 'vitest';
import { ublFixture } from '../helpers/ubl.mjs';
import {
  verifyOriginalsAgainstManifest,
  documentSha256,
  base64Bytes,
} from '../../shared/vat-originals.mjs';

test('a later audit anchors every original to the earlier verified manifest', async () => {
  const { batch, manifest } = await ublFixture();
  await expect(verifyOriginalsAgainstManifest(batch, manifest)).resolves.toBeUndefined();
  const other = await ublFixture();
  await expect(verifyOriginalsAgainstManifest(other.batch, manifest)).rejects.toThrow(/relevé/);
  await expect(
    verifyOriginalsAgainstManifest({ ...batch, documents: [] }, manifest),
  ).rejects.toThrow(/relevé/);
  const altered = structuredClone(batch);
  altered.documents[0].content = btoa('<Invoice/>');
  altered.documents[0].sha256 = await documentSha256(base64Bytes(altered.documents[0].content));
  altered.manifest.documentsRoot = 'b'.repeat(64);
  await expect(verifyOriginalsAgainstManifest(altered, manifest)).rejects.toThrow(/relevé/);
});
