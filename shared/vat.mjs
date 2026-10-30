import {
  vatDocumentsSchema,
  vatDocumentsValidationSchema,
  validateDocumentBindings,
} from './vat-documents.mjs';
import { z } from 'zod';
import { ENGINE } from './engines.mjs';
import { keyFingerprint, publicKeySchema } from './attestations.mjs';
function isDate(n) {
  const s = String(n);
  const d = new Date(s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + 'T00:00:00Z');
  return (
    n >= 19000101 &&
    n <= 21991231 &&
    !isNaN(d) &&
    d.toISOString().slice(0, 10).replaceAll('-', '') === s
  );
}

export const VAT_FORMAT = 'clair-vat-batch/1';
export const VAT_PROOF_FORMAT = 'clair-proof/vat-1';
export const VAT_RATES = [0, 210, 550, 1000, 2000];
export const VAT_CAPACITIES = [10, 50, 100, 250, 500];
export const VAT_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const VAT_DOMAIN = 1129070934;
const cents = z.number().int().min(0).max(100000000);
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => isDate(Number(v.replaceAll('-', ''))), 'Date invalide.');
const field = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .refine(
    (v) => /^0x[0-9a-f]{64}$/.test(v) && BigInt(v) < VAT_FIELD && BigInt(v) > 0n,
    'Empreinte invalide.',
  );
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/);
const invoiceSchema = z
  .object({
    id: identifier,
    date: isoDay,
    kind: z.enum(['invoice', 'credit']),
    reference: identifier.optional(),
    exemptionReason: z.string().trim().max(180).optional(),
    lines: z
      .array(
        z
          .object({
            rateBps: z
              .number()
              .int()
              .refine((v) => VAT_RATES.includes(v), 'Taux non pris en charge.'),
            netCents: cents,
            vatCents: cents,
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();
export const vatDraftSchema = z
  .object({
    format: z.literal('clair-vat-draft/1'),
    companyId: identifier,
    periodStart: isoDay,
    periodEnd: isoDay,
    invoices: z.array(invoiceSchema).min(1).max(500),
  })
  .strict();
const vatManifestV1Schema = z
  .object({
    format: z.literal('clair-vat-manifest/1'),
    issuerId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    keyHash: z.string().regex(/^[a-f0-9]{64}$/),
    companyId: identifier,
    companyHash: field,
    periodStart: isoDay,
    periodEnd: isoDay,
    currency: z.literal('EUR'),
    scope: z.literal('sales-and-credit-notes/invoice-date'),
    rounding: z.literal('half-up-per-invoice-rate'),
    complete: z.literal(true),
    count: z.number().int().min(1).max(500),
    commitment: field,
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();
export const vatManifestSchema = z.discriminatedUnion('format', [
  vatManifestV1Schema,
  vatManifestV1Schema.extend({
    format: z.literal('clair-vat-manifest/2'),
    documentsRoot: z.string().regex(/^[a-f0-9]{64}$/),
    validation: vatDocumentsValidationSchema,
  }),
]);
const vatBatchV1Schema = z
  .object({
    format: z.literal(VAT_FORMAT),
    manifest: vatManifestV1Schema,
    blinding: field,
    invoices: z.array(invoiceSchema).min(1).max(500),
  })
  .strict();
export const vatBatchSchema = z.discriminatedUnion('format', [
  vatBatchV1Schema,
  vatBatchV1Schema.extend({
    format: z.literal('clair-vat-batch/2'),
    manifest: vatManifestSchema.options[1],
    documents: vatDocumentsSchema,
  }),
]);
export const vatConfigSchema = z
  .object({
    capacity: z.number().refine((v) => VAT_CAPACITIES.includes(v)),
  })
  .strict();
export const vatInputs = () =>
  [
    { id: 'period_start', label: 'Début de période', type: 'date' },
    { id: 'period_end', label: 'Fin de période', type: 'date' },
    { id: 'invoice_count', label: 'Nombre de factures et avoirs', type: 'number' },
    { id: 'sales_vat', label: 'TVA des ventes en centimes', type: 'number' },
    { id: 'credit_vat', label: 'TVA des avoirs en centimes', type: 'number' },
  ].map((i) => ({ ...i, visibility: 'public', source: 'declared' }));
export function vatCircuit(capacity = 500) {
  vatConfigSchema.parse({ capacity });
  return {
    version: 2,
    engine: ENGINE,
    name: 'TVA collectée · ' + capacity + ' factures',
    description:
      'Somme de la TVA des ventes et des avoirs sur un relevé exhaustif signé, selon la date de facture. EUR ; arrondi par facture et par taux. Les factures restent privées.',
    inputs: vatInputs(),
    root: { kind: 'constant', type: 'boolean', value: true },
    vat: { capacity },
  };
}
export function validateVatCircuit(c) {
  const expected = vatCircuit(c.vat.capacity);
  if (c.name !== expected.name || c.description !== expected.description)
    throw Error('Le descripteur du programme TVA est fixe.');
  if (
    c.version !== 2 ||
    c.engine !== ENGINE ||
    JSON.stringify(c.inputs) !== JSON.stringify(vatInputs()) ||
    JSON.stringify(c.root) !== JSON.stringify({ kind: 'constant', type: 'boolean', value: true })
  )
    throw Error('Structure du circuit TVA incompatible. Noir est requis.');
  vatConfigSchema.parse(c.vat);
  return c;
}
export function vatCapacity(n) {
  if (!Number.isInteger(n) || n < 1 || n > 500) throw Error('Choisissez entre 1 et 500 pièces.');
  return VAT_CAPACITIES.find((v) => n <= v);
}
export const vatHex = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
export async function vatTextField(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  return vatHex((BigInt('0x' + hex) % (VAT_FIELD - 1n)) + 1n);
}
export function vatSummary(raw) {
  const d = vatDraftSchema.parse(raw);
  if (d.periodStart > d.periodEnd) throw Error('La période est inversée.');
  const ids = new Set();
  let sales = 0,
    credits = 0;
  for (const i of d.invoices) {
    if (ids.has(i.id)) throw Error('Identifiant de facture présent plusieurs fois.');
    ids.add(i.id);
    if (i.date < d.periodStart || i.date > d.periodEnd)
      throw Error('Une facture est hors période.');
    if (i.kind === 'credit' ? !i.reference || i.reference === i.id : !!i.reference)
      throw Error(
        'Un avoir doit référencer une facture distincte ; une vente ne doit pas porter de référence d’avoir.',
      );
    const rates = new Set();
    for (const l of i.lines) {
      if (rates.has(l.rateBps)) throw Error('Regroupez les bases d’une facture par taux de TVA.');
      rates.add(l.rateBps);
      if (l.rateBps === 0 && l.netCents > 0 && !i.exemptionReason)
        throw Error('Un motif est requis pour une base sans TVA.');
      if (l.vatCents !== Math.floor((l.netCents * l.rateBps + 5000) / 10000))
        throw Error('TVA incorrecte : arrondi au centime par facture et par taux requis.');
      if (i.kind === 'credit') credits += l.vatCents;
      else sales += l.vatCents;
    }
  }
  if (sales > 4294967295 || credits > 4294967295)
    throw Error('Plafond de TVA de 42 949 672,95 € dépassé pour les ventes ou les avoirs.');
  return { draft: d, sales, credits, net: sales - credits };
}
export function vatDraftFromBatch(batch) {
  return {
    format: 'clair-vat-draft/1',
    companyId: batch.manifest.companyId,
    periodStart: batch.manifest.periodStart,
    periodEnd: batch.manifest.periodEnd,
    invoices: batch.invoices,
  };
}
export function parseVatBatch(raw) {
  const b = vatBatchSchema.parse(raw);
  vatSummary(vatDraftFromBatch(b));
  validateDocumentBindings(b);
  if (b.manifest.count !== b.invoices.length)
    throw Error('Le relevé signé ne correspond pas au nombre de factures.');
  validateManifestDates(b.manifest);
  return b;
}
function validateManifestDates(m) {
  if (
    m.periodStart > m.periodEnd ||
    Date.parse(m.issuedAt) < Date.parse(m.periodEnd + 'T23:59:59.999Z') ||
    Date.parse(m.expiresAt) <= Date.parse(m.issuedAt)
  )
    throw Error('Le relevé doit certifier une période clôturée et porter une expiration valide.');
}
function manifestBytes(m) {
  return new TextEncoder().encode(
    JSON.stringify([
      m.format,
      m.issuerId,
      m.keyHash,
      m.companyId,
      m.companyHash,
      m.periodStart,
      m.periodEnd,
      m.currency,
      m.scope,
      m.rounding,
      m.complete,
      m.count,
      m.commitment,
      m.issuedAt,
      m.expiresAt,
      ...(m.format === 'clair-vat-manifest/2'
        ? [m.documentsRoot, [m.validation.ubl, m.validation.en16931, m.validation.peppol]]
        : []),
    ]),
  );
}
const encode = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
const decode = (s) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/') + '=='), (c) => c.charCodeAt(0));
export async function signVatManifest(raw, privateJwk, publicJwk) {
  const m = vatManifestSchema.parse({
    ...raw,
    keyHash: await keyFingerprint(publicJwk),
    signature: 'A'.repeat(86),
  });
  validateManifestDates(m);
  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  m.signature = encode(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, manifestBytes(m)),
  );
  if (!(await verifyVatSignature(m, publicJwk)))
    throw Error('La clé privée ne correspond pas à la source.');
  return m;
}
export async function verifyVatSignature(raw, publicJwk) {
  const m = vatManifestSchema.parse(raw),
    jwk = publicKeySchema.parse(publicJwk);
  if (m.keyHash !== (await keyFingerprint(jwk))) return false;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    decode(m.signature),
    manifestBytes(m),
  );
}
export async function verifyVatManifest(raw, issuers = [], now = Date.now()) {
  const m = vatManifestSchema.parse(raw);
  const source = issuers.find((i) => i.id === m.issuerId);
  let reason = '';
  try {
    validateManifestDates(m);
    if (!source || source.approved === false) throw Error('Source non approuvée ou révoquée.');
    if (Date.parse(m.issuedAt) > now || Date.parse(m.expiresAt) <= now)
      throw Error('Relevé expiré ou pas encore valide.');
    if (m.companyHash !== (await vatTextField('clair-vat-company/1:' + m.companyId)))
      throw Error('Entreprise incohérente.');
    if (!(await verifyVatSignature(m, source.jwk))) throw Error('Signature du relevé incorrecte.');
  } catch (e) {
    reason = e.message;
  }
  return {
    inputId: 'vat_batch',
    issuerId: m.issuerId,
    issuerName: source?.name ?? m.issuerId,
    keyHash: m.keyHash,
    expiresAt: m.expiresAt,
    valid: !reason,
    reason,
  };
}
export function vatPublicValues(batch) {
  const { sales, credits } = vatSummary(vatDraftFromBatch(batch));
  return {
    period_start: batch.manifest.periodStart,
    period_end: batch.manifest.periodEnd,
    invoice_count: batch.manifest.count,
    sales_vat: sales,
    credit_vat: credits,
  };
}
export function makeVatExample(companyId, periodStart, periodEnd, count = 10) {
  if (!Number.isInteger(count) || count < 1 || count > 500)
    throw Error('Choisissez entre 1 et 500 pièces.');
  const invoices = Array.from({ length: count }, (_, n) => {
    const credit = n % 10 === 9,
      rate = VAT_RATES[n % VAT_RATES.length],
      net = 10000 + n * 137;
    const lines = [
      { rateBps: rate, netCents: net, vatCents: Math.floor((net * rate + 5000) / 10000) },
    ];
    if (n % 3 === 0 && rate !== 2000) lines.push({ rateBps: 2000, netCents: 2500, vatCents: 500 });
    return {
      id: (credit ? 'AV-' : 'FA-') + String(n + 1).padStart(6, '0'),
      date: periodStart,
      kind: credit ? 'credit' : 'invoice',
      ...(credit ? { reference: 'FA-' + String(n).padStart(6, '0') } : {}),
      ...(rate === 0
        ? { exemptionReason: 'Exonération certifiée par la source de démonstration' }
        : {}),
      lines,
    };
  });
  const d = { format: 'clair-vat-draft/1', companyId, periodStart, periodEnd, invoices };
  return vatSummary(d).draft;
}
export function parseEuroCents(text) {
  if (!/^-?\d{1,8}(?:[,.]\d{1,2})?$/.test(text.trim()))
    throw Error('Montant attendu en euros, avec deux décimales au maximum.');
  const s = text.trim().replace(',', '.'),
    negative = s.startsWith('-'),
    [whole, fraction = ''] = s.replace('-', '').split('.');
  return (negative ? -1 : 1) * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}
export const vatMoney = (cents) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
