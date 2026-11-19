import { zipSync } from 'fflate';
import { base64Bytes } from '../../shared/vat-documents.mjs';
import { downloadBytes } from './files.js';
export function vatOriginalsFilename({ periodStart, periodEnd }) {
  const start = new Date(periodStart + 'T00:00:00Z');
  const endOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const period =
    start.getUTCDate() === 1 && endOfMonth.toISOString().slice(0, 10) === periodEnd
      ? start.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
      : periodStart + '_' + periodEnd;
  return period + '.originaux.clair';
}
export function downloadUblExamples(files) {
  const entries = Object.fromEntries(
    files.map((f, i) => [String(i + 1).padStart(3, '0') + '-' + f.name, f.bytes]),
  );
  downloadBytes(zipSync(entries), 'Exemples.UBL.zip', 'application/zip');
}
export function downloadOriginalUbl(doc) {
  const name = doc.name
    .split(/[\\/]/)
    .pop()
    .replace(/\p{Cc}/gu, '');
  downloadBytes(
    base64Bytes(doc.content),
    name.endsWith('.xml') ? name : doc.invoiceId + '.xml',
    'application/xml',
  );
}
