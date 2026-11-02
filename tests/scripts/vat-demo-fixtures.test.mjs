import { copyClientDocuments } from '../../scripts/vat-demo-report.mjs';
import { test, expect } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import {
  prepareVatDemo,
  loadVatDemo,
  invoiceErrors,
  fixtureReference,
} from '../../scripts/vat-demo-fixtures.mjs';
import { importUblFiles } from '../../src/features/vat/ubl-import.js';
import { Parser, realUblValidator } from '../helpers/ubl.mjs';
test('demo fixtures pass the real validators and intentional errors are rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clair-vat-demo-test-'));
  const validator = realUblValidator();
  try {
    const fixture = await prepareVatDemo(root, [10]),
      folder = join(fixture.directory, 'lots/10/xml');
    const files = await Promise.all(
      (await readdir(folder)).map(async (name) => {
        const bytes = new Uint8Array(await readFile(join(folder, name)));
        return { name, bytes, size: bytes.length, arrayBuffer: async () => bytes.buffer };
      }),
    );
    const options = { Parser, validator, periodStart: '2026-09-01', periodEnd: '2026-09-30' };
    const result = await importUblFiles(files, options);
    expect(result.documents).toHaveLength(10);
    expect(fixtureReference(files)).toMatchObject({
      count: 10,
      invoices: 9,
      credits: 1,
      netVatCents: 19734,
    });
    expect(result.draft.invoices.some((i) => i.kind === 'credit')).toBe(true);
    for (const error of invoiceErrors(files)) {
      const bytes = new TextEncoder().encode(error.text);
      await expect(
        importUblFiles(
          [{ name: error.name, size: bytes.length, arrayBuffer: async () => bytes.buffer }],
          options,
        ),
      ).rejects.toThrow(new RegExp(error.expected));
    }
    await copyClientDocuments(fixture.directory);
    expect(await readFile(join(fixture.directory, 'FICHE-CLIENT.md'), 'utf8')).toContain(
      '(RESULTATS.md)',
    );
    expect(await readdir(root)).not.toContain('latest.json');
    const publicKey = JSON.parse(
      await readFile(join(fixture.directory, 'source/demo-tva.cle-publique.clair'), 'utf8'),
    );
    expect(publicKey.d).toBeUndefined();
    expect((await loadVatDemo(fixture.directory)).config.fictitious).toBe(true);
    await expect(prepareVatDemo(root, [501])).rejects.toThrow(/Volumes/);
  } finally {
    await validator.dispose();
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + sep) ||
      !basename(root).startsWith('clair-vat-demo-test-')
    )
      expect.fail('Nettoyage hors dossier temporaire');
    await rm(root, { recursive: true, force: true });
  }
});
