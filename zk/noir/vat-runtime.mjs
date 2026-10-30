import { BarretenbergSync, Fr } from '@aztec/bb.js';
import {
  VAT_DOMAIN,
  VAT_RATES,
  VAT_FIELD,
  vatHex,
  vatTextField,
  vatSummary,
  vatDraftFromBatch,
  parseVatBatch,
} from '../../shared/vat.mjs';
let initialized;
async function hasher() {
  const api = await (initialized ??= BarretenbergSync.initSingleton().catch((e) => {
    initialized = undefined;
    throw e;
  }));
  return (values) =>
    vatHex(BigInt(api.poseidon2Hash(values.map((v) => new Fr(BigInt(v)))).toString()));
}
async function entries(draft) {
  return Promise.all(
    draft.invoices.map(async (i) => {
      const base = VAT_RATES.map((rate) => i.lines.find((l) => l.rateBps === rate)?.netCents ?? 0);
      const vat = VAT_RATES.map((rate) => i.lines.find((l) => l.rateBps === rate)?.vatCents ?? 0);
      return {
        row: [Number(i.date.replaceAll('-', '')), i.kind === 'credit' ? 1 : 0, ...base, ...vat],
        metadata: [
          await vatTextField('clair-vat-invoice/1:' + i.id),
          i.reference ? await vatTextField('clair-vat-invoice/1:' + i.reference) : '0x0',
          i.exemptionReason
            ? await vatTextField('clair-vat-exemption/1:' + i.exemptionReason)
            : '0x0',
        ],
      };
    }),
  );
}
export async function prepareVatDraft(raw, blinding) {
  const { draft } = vatSummary(raw);
  if (!blinding) {
    const random = crypto.getRandomValues(new Uint8Array(32));
    blinding = vatHex(
      (BigInt('0x' + Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('')) %
        (VAT_FIELD - 1n)) +
        1n,
    );
  }
  if (!/^0x[0-9a-f]{64}$/.test(blinding) || BigInt(blinding) <= 0n || BigInt(blinding) >= VAT_FIELD)
    throw Error('Masque de confidentialité invalide.');
  const hash = await hasher(),
    companyHash = await vatTextField('clair-vat-company/1:' + draft.companyId);
  const invoices = await entries(draft);
  let chain = hash([
    VAT_DOMAIN,
    companyHash,
    Number(draft.periodStart.replaceAll('-', '')),
    Number(draft.periodEnd.replaceAll('-', '')),
    draft.invoices.length,
    blinding,
  ]);
  for (const [i, item] of invoices.entries()) {
    const leaf = hash([...item.metadata, ...item.row]);
    chain = hash([chain, leaf, i + 1]);
  }
  return { commitment: chain, companyHash, blinding };
}
export async function vatWitness(raw, capacity) {
  const batch = parseVatBatch(raw);
  if (batch.invoices.length > capacity) throw Error('La capacité du circuit est dépassée.');
  const draft = vatDraftFromBatch(batch),
    computed = await prepareVatDraft(draft, batch.blinding);
  if (
    computed.commitment !== batch.manifest.commitment ||
    computed.companyHash !== batch.manifest.companyHash
  )
    throw Error('Une facture manque, a été ajoutée, déplacée ou modifiée.');
  const items = await entries(draft);
  return {
    commitment: batch.manifest.commitment,
    company_hash: batch.manifest.companyHash,
    blinding: batch.blinding,
    rows: Array.from(
      { length: capacity },
      (_, i) => items[i]?.row.map(String) ?? Array(12).fill('0'),
    ),
    metadata: Array.from({ length: capacity }, (_, i) => items[i]?.metadata ?? Array(3).fill('0')),
  };
}
