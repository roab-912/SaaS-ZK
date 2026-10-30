import { test, expect } from 'vitest';
import { ublFixture } from '../helpers/ubl.mjs';
import { verifyVatDocuments, base64Bytes, bytesToBase64 } from '../../shared/vat-documents.mjs';
import { verifyVatManifest, parseVatBatch } from '../../shared/vat.mjs';
import { parseProof } from '../../shared/proof.mjs';
test('the signature protects both the normalized VAT commitment and the original-document commitment', async () => {
  const f = await ublFixture();
  expect(parseVatBatch(f.batch).documents).toHaveLength(2);
  await verifyVatDocuments(f.batch);
  expect((await verifyVatManifest(f.manifest, f.issuers)).valid).toBe(true);
  expect(parseProof(f.envelope).vatManifest.documentsRoot).toBe(f.manifest.documentsRoot);
  expect(
    (await verifyVatManifest({ ...f.manifest, documentsRoot: '0'.repeat(64) }, f.issuers)).valid,
  ).toBe(false);
  expect(Buffer.from(base64Bytes(f.batch.documents[0].content))).toEqual(
    Buffer.from(f.files[0].bytes),
  );
  const b = structuredClone(f.batch);
  b.documents[0].content = bytesToBase64(new TextEncoder().encode('<Invoice/>'));
  await expect(verifyVatDocuments(b)).rejects.toThrow(/original/);
  const c = structuredClone(f.batch);
  c.documents[0].originalId = 'changed';
  await expect(verifyVatDocuments(c)).rejects.toThrow(/relevé signé/);
  expect(() => parseVatBatch({ ...f.batch, documents: f.batch.documents.slice(1) })).toThrow(
    /nombre/,
  );
  expect(() => parseProof({ ...f.envelope, documents: f.batch.documents })).toThrow();
});
