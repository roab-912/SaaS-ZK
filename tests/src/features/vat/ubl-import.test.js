import { test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { vatSummary } from '../../../../shared/vat.mjs';
import { importUblFiles } from '../../../../src/features/vat/ubl-import.js';
import { Parser, ublFiles, fakeUblValidator, realUblValidator } from '../../../helpers/ubl.mjs';
const options = {
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  Parser,
  validator: fakeUblValidator,
};
test('import accepts UBL XML documents and enforces count, size and cancellation limits', async () => {
  const f = ublFiles(),
    r = await importUblFiles(f, options);
  expect(r.documents).toHaveLength(2);
  expect(Buffer.from(r.documents[0].content, 'base64')).toEqual(Buffer.from(f[0].bytes));
  expect(r.draft.invoices[1].reference).toBe(r.draft.invoices[0].id);
  await expect(importUblFiles(Array(501).fill(f[0]), options)).rejects.toThrow(/500/);
  await expect(importUblFiles(f, { ...options, isCurrent: () => false })).rejects.toThrow(/annulé/);
  await expect(importUblFiles([{ ...f[0], size: 25000001 }], options)).rejects.toThrow(/25 Mo/);
});

test('JSON invoice drafts are rejected even when renamed to .xml', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ format: 'clair-vat-draft/1', invoices: [] }),
  );
  await expect(
    importUblFiles(
      [{ name: 'facture.xml', size: bytes.length, arrayBuffer: async () => bytes.buffer }],
      options,
    ),
  ).rejects.toThrow(/XML mal formé/);
});

const examples = ['vatira-sale.xml', 'vatira-reverse-charge.xml', 'vatira-export.xml'];
async function exampleFile(name) {
  const bytes = new Uint8Array(await readFile('tests/fixtures/ubl/' + name));
  return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer };
}
function xmlFile(text) {
  const bytes = new TextEncoder().encode(text);
  return { name: 'non-conforme.xml', size: bytes.length, arrayBuffer: async () => bytes.buffer };
}
test('strictly valid foreign sales, reverse-charge and export documents retain their invoiced VAT', async () => {
  const validator = realUblValidator();
  try {
    const files = await Promise.all(examples.map(exampleFile));
    const r = await importUblFiles(files, {
      ...options,
      validator,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });
    expect(r.draft.companyId).toBe('DE123456789');
    expect(r.draft.invoices.map((i) => i.lines)).toEqual([
      [{ rateBps: 2000, netCents: 198250, vatCents: 39650 }],
      [{ rateBps: 0, netCents: 95500, vatCents: 0 }],
      [{ rateBps: 0, netCents: 460000, vatCents: 0 }],
    ]);
    expect(r.draft.invoices[1].exemptionReason).toContain('AE');
    expect(r.draft.invoices[2].exemptionReason).toContain('G');
    expect(vatSummary(r.draft).net).toBe(39650);
    for (const [i, file] of files.entries())
      expect(Buffer.from(r.documents[i].content, 'base64')).toEqual(
        Buffer.from(await file.arrayBuffer()),
      );
  } finally {
    await validator.dispose();
  }
});
test('malformed Vatira exports are still rejected; importing never repairs their XML', async () => {
  const validator = realUblValidator(),
    strict = { ...options, validator, periodStart: '2026-08-01', periodEnd: '2026-08-31' };
  try {
    for (const name of examples) {
      const good = new TextDecoder().decode(await (await exampleFile(name)).arrayBuffer());
      const note = good.match(/<cbc:Note>[^<]*<\/cbc:Note>/)[0];
      const invalid = good
        .replace(note, '')
        .replace('</cbc:DocumentCurrencyCode>', '</cbc:DocumentCurrencyCode>' + note);
      await expect(importUblFiles([xmlFile(invalid)], strict)).rejects.toThrow(
        /Note.*avant DocumentCurrencyCode/,
      );
    }
    const exported = new TextDecoder().decode(
      await (await exampleFile('vatira-export.xml')).arrayBuffer(),
    );
    await expect(
      importUblFiles([xmlFile(exported.replaceAll('VATEX-EU-G', 'VATEX-EU-E'))], strict),
    ).rejects.toThrow(/BR-CL-22/);
    await expect(
      importUblFiles([xmlFile(exported.replace('schemeID="9932"', 'schemeID="0151"'))], strict),
    ).rejects.toThrow(/PEPPOL-COMMON-R050/);
    await expect(
      importUblFiles(
        [xmlFile(exported.replaceAll('<cbc:ID>G</cbc:ID>', '<cbc:ID>E</cbc:ID>'))],
        strict,
      ),
    ).rejects.toThrow(/P0104/);
    const sale = new TextDecoder().decode(
      await (await exampleFile('vatira-sale.xml')).arrayBuffer(),
    );
    await expect(
      importUblFiles(
        [
          xmlFile(
            sale.replace(
              '<cbc:TaxAmount currencyID="EUR">396.50',
              '<cbc:TaxAmount currencyID="EUR">396.51',
            ),
          ),
        ],
        strict,
      ),
    ).rejects.toThrow(/BR-/);
  } finally {
    await validator.dispose();
  }
});

test('import progress counts only successfully verified documents', async () => {
  const counts = [];
  await importUblFiles(ublFiles(), {
    ...options,
    onProgress: (_message, count) => counts.push(count),
  });
  expect(counts).toEqual([
    { completed: 0, total: 2 },
    { completed: 1, total: 2 },
    { completed: 1, total: 2 },
    { completed: 2, total: 2 },
  ]);
  const failure = [];
  await expect(
    importUblFiles(ublFiles(), {
      ...options,
      validator: {
        validate: async () => {
          throw Error('non conforme');
        },
      },
      onProgress: (_message, count) => failure.push(count),
    }),
  ).rejects.toThrow('non conforme');
  expect(failure).toEqual([{ completed: 0, total: 2 }]);
});
