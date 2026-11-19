export const VAT_DOCUMENT_LIMITS = {
  fileBytes: 2000000,
  totalBytes: 25000000,
  certifiedBytes: 40000000,
};
export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function base64Bytes(text) {
  const s = atob(text);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
export async function documentSha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function validateDocumentBindings(batch) {
  if (batch.format !== 'clair-vat-batch/2') return;
  if (batch.documents.length !== batch.invoices.length)
    throw Error('Le nombre de documents UBL diffère du relevé.');
  let total = 0;
  for (const [i, doc] of batch.documents.entries()) {
    if (doc.invoiceId !== batch.invoices[i].id || doc.kind !== batch.invoices[i].kind)
      throw Error('Association entre facture et document UBL incorrecte.');
    const size =
      (doc.content.length / 4) * 3 -
      (doc.content.endsWith('==') ? 2 : doc.content.endsWith('=') ? 1 : 0);
    total += size;
    if (size > VAT_DOCUMENT_LIMITS.fileBytes || total > VAT_DOCUMENT_LIMITS.totalBytes)
      throw Error('Documents UBL trop volumineux (2 Mo par fichier, 25 Mo au total).');
  }
}
export async function vatDocumentsRoot({ documents, blinding, companyId, periodStart, periodEnd }) {
  const payload = [
    'clair-ubl-documents/1',
    blinding,
    companyId,
    periodStart,
    periodEnd,
    documents.map((d) => [d.invoiceId, d.kind, d.originalId, d.sha256, d.profile]),
  ];
  return documentSha256(new TextEncoder().encode(JSON.stringify(payload)));
}
export async function verifyVatDocuments(batch) {
  if (batch.format !== 'clair-vat-batch/2') return;
  validateDocumentBindings(batch);
  for (const doc of batch.documents)
    if ((await documentSha256(base64Bytes(doc.content))) !== doc.sha256)
      throw Error('Un document UBL original a été modifié.');
  const root = await vatDocumentsRoot({
    documents: batch.documents,
    blinding: batch.blinding,
    ...batch.manifest,
  });
  if (root !== batch.manifest.documentsRoot)
    throw Error('Les documents UBL ne correspondent pas au relevé signé.');
}

// Only the previously verified public manifest provides the reference for an audit.
export async function verifyOriginalsAgainstManifest(batch, manifest) {
  if (manifest?.format !== 'clair-vat-manifest/2' || batch?.format !== 'clair-vat-batch/2')
    throw Error('Un lot certifié avec ses XML originaux est requis.');
  if (
    batch.manifest?.signature !== manifest.signature ||
    batch.documents?.length !== manifest.count
  )
    throw Error('Ce lot ne correspond pas au relevé de la preuve acceptée.');
  await verifyVatDocuments({ ...batch, manifest });
}
