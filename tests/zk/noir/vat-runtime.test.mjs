import { test, expect } from 'vitest';
import { vatFixture } from '../../helpers/vat.mjs';
import { prepareVatDraft, vatWitness } from '../../../zk/noir/vat-runtime.mjs';
test('commitments preserve ordering, company, dates and private blinding, with zero padding', async () => {
  const f = await vatFixture(2, true),
    w = await vatWitness(f.batch, 10);
  expect(w.rows).toHaveLength(10);
  expect(w.rows[2]).toEqual(Array(12).fill('0'));
  expect(w.metadata[2]).toEqual(Array(3).fill('0'));
  expect((await prepareVatDraft(f.draft, f.batch.blinding)).commitment).toBe(f.manifest.commitment);
  const d = structuredClone(f.draft);
  d.invoices.reverse();
  expect((await prepareVatDraft(d, f.batch.blinding)).commitment).not.toBe(f.manifest.commitment);
  await expect(vatWitness({ ...f.batch, invoices: d.invoices }, 10)).rejects.toThrow(/modifiée/);
  await expect(vatWitness(f.batch, 1)).rejects.toThrow(/capacité/);
  expect((await prepareVatDraft(f.draft)).commitment).not.toBe(f.manifest.commitment);
  await expect(prepareVatDraft(f.draft, 'bad')).rejects.toThrow();
});
