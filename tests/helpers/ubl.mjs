import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'fflate';
import SaxonJS from 'saxon-js';
import { createUblValidator } from '../../src/lib/ubl-validation.js';
import { importUblFiles } from '../../src/features/vat/ubl-import.js';
import { makeUblExamples } from '../../shared/ubl-examples.mjs';
import { UBL_VALIDATION_VERSION, vatDocumentsRoot } from '../../shared/vat-documents.mjs';
import { vatTextField, vatHex, signVatManifest, vatPublicValues } from '../../shared/vat.mjs';
import { buildProofEnvelope, contextField } from '../../shared/proof.mjs';
import { vatFixture } from './vat.mjs';
export const Parser = new JSDOM('').window.DOMParser;
export const fakeUblValidator = {
  validate: async (_xml, parsed) => ({
    validation: UBL_VALIDATION_VERSION,
    profile: parsed.profile,
    warnings: [],
  }),
};
export function realUblValidator(overrides = {}) {
  return createUblValidator({
    Parser,
    loadSaxon: async () => SaxonJS,
    loadJson: async (n) =>
      JSON.parse(new TextDecoder().decode(gunzipSync(await readFile('public/ubl/' + n)))),
    ...overrides,
  });
}
export function ublFiles(count = 2, peppol = false) {
  return makeUblExamples({ count, peppol }).map((f) => ({
    name: f.name,
    size: f.bytes.length,
    arrayBuffer: async () => f.bytes.buffer,
    bytes: f.bytes,
  }));
}
export async function ublFixture(count = 2, real = false) {
  const f = await vatFixture(count),
    files = ublFiles(count);
  const imported = await importUblFiles(files, {
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    Parser,
    validator: fakeUblValidator,
  });
  const commitment = real
    ? await (await import('../../zk/noir/vat-runtime.mjs')).prepareVatDraft(imported.draft)
    : {
        commitment: vatHex(123n),
        blinding: vatHex(456n),
        companyHash: await vatTextField('clair-vat-company/1:' + imported.draft.companyId),
      };
  const documentsRoot = await vatDocumentsRoot({
    ...imported.draft,
    documents: imported.documents,
    blinding: commitment.blinding,
  });
  const manifest = await signVatManifest(
    {
      ...f.manifest,
      format: 'clair-vat-manifest/2',
      companyId: imported.draft.companyId,
      companyHash: commitment.companyHash,
      commitment: commitment.commitment,
      documentsRoot,
      validation: UBL_VALIDATION_VERSION,
    },
    f.priv,
    f.pub,
  );
  const batch = {
    format: 'clair-vat-batch/2',
    manifest,
    blinding: commitment.blinding,
    invoices: imported.draft.invoices,
    documents: imported.documents,
  };
  const values = vatPublicValues(batch),
    envelope = buildProofEnvelope({
      engine: f.circuit.engine,
      circuit: f.circuit,
      circuitHash: f.envelope.circuitHash,
      proof: 'AAAA',
      vatManifest: manifest,
      publicInputs: [
        contextField(f.envelope.circuitHash),
        '0x1',
        ...Object.values(values).map((v) =>
          vatHex(typeof v === 'string' ? v.replaceAll('-', '') : v),
        ),
        manifest.commitment,
        manifest.companyHash,
      ],
    });
  return { ...f, files, imported, batch, manifest, values, envelope };
}
