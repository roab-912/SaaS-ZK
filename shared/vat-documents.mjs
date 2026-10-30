import { z } from 'zod';
export const VAT_DOCUMENT_LIMITS = {
  fileBytes: 2000000,
  totalBytes: 25000000,
  certifiedBytes: 40000000,
};
export const UBL_VALIDATION_VERSION = Object.freeze({
  ubl: '2.1',
  en16931: '1.3.17',
  peppol: '3.0.21',
});
export const vatDocumentsValidationSchema = z
  .object({
    ubl: z.literal('2.1'),
    en16931: z.literal('1.3.17'),
    peppol: z.literal('3.0.21'),
  })
  .strict();
export const vatDocumentSchema = z
  .object({
    invoiceId: z.string().regex(/^[a-zA-Z0-9 ._/-]{1,80}$/),
    originalId: z.string().min(1).max(256),
    kind: z.enum(['invoice', 'credit']),
    name: z.string().min(1).max(255),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    profile: z.enum(['en16931', 'peppol-bis3']),
    content: z
      .string()
      .max(2666668)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((v) => v.length % 4 === 0),
  })
  .strict();
export const vatDocumentsSchema = z.array(vatDocumentSchema).min(1).max(500);
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
