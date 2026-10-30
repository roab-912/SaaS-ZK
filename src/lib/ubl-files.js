import { zipSync } from 'fflate';
import { base64Bytes } from '../../shared/vat-documents.mjs';
import { downloadBytes } from './files.js';
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
