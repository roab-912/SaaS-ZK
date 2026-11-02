import {
  UBL_LIMITS,
  decodeUbl,
  parseUblXml,
  normalizeUbl,
  ublDraft,
  sha256Hex,
} from '../../../shared/ubl.mjs';
import { bytesToBase64 } from '../../../shared/vat-documents.mjs';
import { ublValidator } from '../../lib/ubl-validation.js';
export async function importUblFiles(
  files,
  {
    periodStart,
    periodEnd,
    validator = ublValidator,
    Parser = globalThis.DOMParser,
    isCurrent = () => true,
    onProgress = () => {},
  } = {},
) {
  const selected = Array.from(files);
  if (!selected.length || selected.length > UBL_LIMITS.files)
    throw Error('Sélectionnez entre 1 et 500 fichiers UBL.');
  if (
    selected.some((f) => f.size > UBL_LIMITS.fileBytes) ||
    selected.reduce((s, f) => s + f.size, 0) > UBL_LIMITS.totalBytes
  )
    throw Error('UBL : 2 Mo par fichier et 25 Mo au total au maximum.');
  const records = [],
    documents = [],
    reports = [];
  let total = 0;
  for (const [i, file] of selected.entries()) {
    if (!isCurrent()) throw Error('Import UBL annulé.');
    onProgress('Validation UBL ' + (i + 1) + ' / ' + selected.length + ' : ' + file.name, {
      completed: i,
      total: selected.length,
    });
    // Let the browser paint progress and respond to cancellation between documents.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      total += bytes.byteLength;
      if (total > UBL_LIMITS.totalBytes) throw Error('Les fichiers dépassent 25 Mo.');
      const xml = decodeUbl(bytes),
        parsed = parseUblXml(xml, Parser);
      const report = await validator.validate(xml, parsed),
        record = await normalizeUbl(parsed);
      if (!isCurrent()) throw Error('Import UBL annulé.');
      records.push(record);
      reports.push({ ...report, name: file.name });
      onProgress('Document vérifié : ' + file.name, { completed: i + 1, total: selected.length });
      documents.push({
        invoiceId: record.invoice.id,
        originalId: record.originalId,
        kind: record.invoice.kind,
        name: file.name.slice(0, 255),
        sha256: await sha256Hex(bytes),
        profile: record.profile,
        content: bytesToBase64(bytes),
      });
    } catch (e) {
      throw Error(file.name + ' : ' + e.message, { cause: e });
    }
  }
  return { draft: ublDraft(records, periodStart, periodEnd), documents, reports };
}
