import { test, expect } from 'vitest';
import { vatFixture } from '../helpers/vat.mjs';
import {
  vatSummary,
  makeVatExample,
  parseVatBatch,
  verifyVatManifest,
  vatCircuit,
  vatCapacity,
  parseEuroCents,
  vatMoney,
  vatHex,
  signVatManifest,
} from '../../shared/vat.mjs';
import { parseProof, validateCircuit } from '../../shared/circuit.mjs';
test('supports 500 multi-rate invoices and credits with integer half-up rounding', () => {
  const d = makeVatExample('DEMO', '2026-09-01', '2026-09-30', 500),
    s = vatSummary(d);
  expect(s.sales).toBeGreaterThan(s.credits);
  expect(s.credits).toBeGreaterThan(0);
  const half = {
    ...d,
    invoices: [
      {
        id: 'a',
        date: d.periodStart,
        kind: 'invoice',
        lines: [{ rateBps: 1000, netCents: 5, vatCents: 1 }],
      },
    ],
  };
  expect(vatSummary(half).net).toBe(1);
  half.invoices[0].kind = 'credit';
  half.invoices[0].reference = 'original';
  expect(vatSummary(half).net).toBe(-1);
  expect(parseEuroCents('-1,23')).toBe(-123);
  expect(parseEuroCents('1.2')).toBe(120);
  expect(() => parseEuroCents('1,234')).toThrow();
  expect(vatMoney(123)).toContain('1,23');
  expect(vatCapacity(500)).toBe(500);
  expect(vatCapacity(11)).toBe(50);
  expect(() => vatCapacity(501)).toThrow();
});
test('rejects omissions, duplicate identifiers, bad dates, rates, rounding and uncertified exemptions', async () => {
  const f = await vatFixture();
  expect(parseVatBatch(f.batch).manifest.count).toBe(2);
  const copy = () => structuredClone(f.draft);
  let d = copy();
  d.invoices.push(d.invoices[0]);
  expect(() => vatSummary(d)).toThrow(/plusieurs fois/);
  d = copy();
  d.invoices[0].date = '2026-08-31';
  expect(() => vatSummary(d)).toThrow(/hors période/);
  d = copy();
  d.invoices[0].date = '2026-02-30';
  expect(() => vatSummary(d)).toThrow();
  d = copy();
  d.invoices[0].lines[0].vatCents++;
  expect(() => vatSummary(d)).toThrow(/TVA incorrecte/);
  d = copy();
  d.invoices[0].lines[0].rateBps = 850;
  expect(() => vatSummary(d)).toThrow();
  d = copy();
  delete d.invoices[0].exemptionReason;
  expect(() => vatSummary(d)).toThrow(/motif/);
  d = copy();
  d.invoices[0].kind = 'credit';
  expect(() => vatSummary(d)).toThrow(/référencer/);
  d = copy();
  d.invoices[0].lines.push(d.invoices[0].lines[0]);
  expect(() => vatSummary(d)).toThrow(/Regroupez/);
  expect(() => parseVatBatch({ ...f.batch, invoices: f.batch.invoices.slice(1) })).toThrow(
    /nombre/,
  );
  expect(() => makeVatExample('DEMO', '2026-09-01', '2026-09-30', 501)).toThrow();
});
test('manifest signature binds company, closed period, complete count and commitment to an approved source', async () => {
  const f = await vatFixture();
  expect((await verifyVatManifest(f.manifest, f.issuers)).valid).toBe(true);
  expect(
    (
      await verifyVatManifest(
        f.manifest,
        f.issuers.map(({ approved, ...i }) => i),
      )
    ).valid,
  ).toBe(true);
  for (const m of [
    { ...f.manifest, companyId: 'OTHER' },
    { ...f.manifest, count: 1 },
    { ...f.manifest, commitment: vatHex(999n) },
    { ...f.manifest, periodEnd: '2026-09-29' },
  ])
    expect((await verifyVatManifest(m, f.issuers)).valid).toBe(false);
  expect((await verifyVatManifest(f.manifest, [])).valid).toBe(false);
  expect((await verifyVatManifest(f.manifest, [{ ...f.issuers[0], approved: false }])).valid).toBe(
    false,
  );
  expect(
    (await verifyVatManifest(f.manifest, f.issuers, Date.parse(f.manifest.expiresAt) + 1)).valid,
  ).toBe(false);
  await expect(
    signVatManifest({ ...f.manifest, issuedAt: '2026-09-01T00:00:00.000Z' }, f.priv, f.pub),
  ).rejects.toThrow(/clôturée/);
  await expect(
    signVatManifest({ ...f.manifest, complete: false }, f.priv, f.pub),
  ).rejects.toThrow();
});
test('proof format binds manifest to public values and allows only the fixed Noir VAT program', async () => {
  const f = await vatFixture();
  expect(parseProof(f.envelope)).toEqual(f.envelope);
  for (const name of ['periodStart', 'periodEnd', 'count', 'commitment', 'companyHash']) {
    const e = structuredClone(f.envelope);
    e.vatManifest[name] =
      name === 'count'
        ? 1
        : name.includes('Hash') || name === 'commitment'
          ? vatHex(999n)
          : '2026-09-02';
    expect(() => parseProof(e)).toThrow();
  }
  expect(() => parseProof({ ...f.envelope, invoices: f.batch.invoices })).toThrow();
  expect(() =>
    validateCircuit({ ...vatCircuit(), engine: 'circom223-snarkjs076-plonk-v1' }),
  ).toThrow(/Noir/);
  expect(() =>
    validateCircuit({ ...vatCircuit(), root: { kind: 'constant', type: 'boolean', value: false } }),
  ).toThrow();
  expect(() => validateCircuit(vatCircuit(12))).toThrow();
  expect(() => validateCircuit({ ...vatCircuit(), name: 'Another costly variant' })).toThrow(
    /fixe/,
  );
  expect(() => validateCircuit({ ...vatCircuit(), description: 'Another costly variant' })).toThrow(
    /fixe/,
  );
});
