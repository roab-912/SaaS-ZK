import { test, expect } from 'vitest';
import { verifyUblInputs } from '../../scripts/build-ubl-assets.mjs';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'fflate';
test('official validation resources are pinned and compressed for local execution', async () => {
  const lock = await verifyUblInputs();
  expect(lock.en16931).toBe('1.3.17');
  expect(lock.peppol).toBe('3.0.21');
  expect(Object.keys(lock.inputs).filter((p) => p.endsWith('.xsd'))).toHaveLength(15);
  const schemas = JSON.parse(
    new TextDecoder().decode(gunzipSync(await readFile('public/ubl/schemas-2.1.json.gz'))),
  );
  expect(schemas['maindoc/UBL-Invoice-2.1.xsd']).toContain('InvoiceType');
  expect(schemas['maindoc/UBL-CreditNote-2.1.xsd']).toContain('CreditNoteType');
});
