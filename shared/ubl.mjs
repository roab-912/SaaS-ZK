import { SaxesParser } from 'saxes';
import { vatSummary, VAT_RATES } from './vat.mjs';
export const UBL_NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  credit: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
};
export const UBL_CORE = 'urn:cen.eu:en16931:2017';
export const UBL_PEPPOL = UBL_CORE + '#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
export const UBL_LIMITS = {
  files: 500,
  fileBytes: 2000000,
  totalBytes: 25000000,
  certifiedBytes: 40000000,
  elements: 20000,
  depth: 64,
};
export async function sha256Hex(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function decodeUbl(bytes) {
  if (bytes.byteLength > UBL_LIMITS.fileBytes)
    throw Error('Fichier UBL trop volumineux (2 Mo maximum).');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw Error('UBL : seul l’encodage UTF-8 est pris en charge.');
  }
  const encoding = text.match(/^\s*<\?xml[^?]*encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  if (encoding && !/^utf-8$/i.test(encoding))
    throw Error('UBL : seul l’encodage UTF-8 est pris en charge.');
  return text;
}
export function parseUblXml(xml, Parser = globalThis.DOMParser) {
  if (typeof xml !== 'string' || new TextEncoder().encode(xml).length > UBL_LIMITS.fileBytes)
    throw Error('XML trop volumineux.');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || /<\?(?!xml(?:\s|\?>))/i.test(xml))
    throw Error('UBL : DTD, entités et instructions de traitement sont interdites.');
  try {
    const scanner = new SaxesParser({ xmlns: true, position: false });
    let count = 0,
      depth = 0;
    scanner.on('opentag', () => {
      if (++count > UBL_LIMITS.elements || ++depth > UBL_LIMITS.depth)
        throw new RangeError('UBL : structure XML trop complexe.');
    });
    scanner.on('closetag', () => {
      depth--;
    });
    scanner.on('doctype', () => {
      throw Error('DTD interdite.');
    });
    scanner.on('error', (e) => {
      throw e;
    });
    scanner.write(xml).close();
  } catch (e) {
    if (e instanceof RangeError) throw e;
    throw Error('Document XML mal formé.', { cause: e });
  }
  if (!Parser) throw Error('Analyseur XML local indisponible.');
  const doc = new Parser().parseFromString(xml, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagNameNS('*', 'parsererror').length)
    throw Error('Document XML mal formé.');
  const root = doc.documentElement;
  if (!(
    (root.localName === 'Invoice' && root.namespaceURI === UBL_NS.invoice) ||
    (root.localName === 'CreditNote' && root.namespaceURI === UBL_NS.credit)
  ))
    throw Error('UBL 2.1 attendu : Invoice ou CreditNote avec son espace de noms officiel.');
  const stack = [[root, 1]];
  let count = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (++count > UBL_LIMITS.elements || depth > UBL_LIMITS.depth)
      throw Error('UBL : structure XML trop complexe.');
    for (const child of node.children) stack.push([child, depth + 1]);
  }
  const version = text(root, 'cbc', 'UBLVersionID', false);
  if (version && version !== '2.1') throw Error('Seul UBL 2.1 est pris en charge.');
  const customization = text(root, 'cbc', 'CustomizationID');
  if (customization !== UBL_CORE && customization !== UBL_PEPPOL)
    throw Error(
      'Profil UBL non pris en charge : EN16931 standard ou Peppol BIS Billing 3.0 attendu. Les extensions nationales nécessitent leur propre adaptateur.',
    );
  return {
    doc,
    kind: root.localName === 'Invoice' ? 'invoice' : 'credit',
    profile: customization === UBL_PEPPOL ? 'peppol-bis3' : 'en16931',
  };
}
function children(node, ns, name) {
  return Array.from(node.children).filter(
    (n) => n.namespaceURI === UBL_NS[ns] && n.localName === name,
  );
}
function one(node, ns, name, required = true) {
  const nodes = children(node, ns, name);
  if (nodes.length > 1 || (required && nodes.length !== 1))
    throw Error('UBL : champ ' + name + ' absent ou ambigu.');
  return nodes[0] ?? null;
}
function text(node, ns, name, required = true) {
  const n = one(node, ns, name, required),
    value = n?.textContent.trim() ?? '';
  if (required && !value) throw Error('UBL : ' + name + ' requis.');
  return value;
}
function decimal(value, scale, label) {
  const match = value.trim().match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);
  if (!match) throw Error('UBL : ' + label + ' doit être un nombre décimal XML.');
  const whole = match[2] ?? '0',
    fraction = match[3] ?? match[4] ?? '';
  if (fraction.length > scale || whole.length > 14)
    throw Error('UBL : précision ou montant non pris en charge pour ' + label + '.');
  const result =
    (match[1] === '-' ? -1n : 1n) *
    (BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0'));
  if (result < 0n || result > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error('UBL : montant négatif ou trop élevé non pris en charge pour ' + label + '.');
  return Number(result);
}
export const ublCents = (value) => decimal(value, 2, 'montant');
function money(node, name) {
  const n = one(node, 'cbc', name);
  if (n.getAttribute('currencyID') !== 'EUR')
    throw Error('UBL : tous les montants de TVA doivent être en EUR.');
  return ublCents(n.textContent);
}
async function invoiceId(company, original, kind) {
  return (
    'ubl-' +
    (kind === 'credit' ? 'cn-' : 'inv-') +
    (await sha256Hex(new TextEncoder().encode(JSON.stringify([company, original]))))
  );
}
export async function normalizeUbl(parsed) {
  const { doc, kind, profile } = parsed,
    root = doc.documentElement;
  const type = text(root, 'cbc', kind === 'credit' ? 'CreditNoteTypeCode' : 'InvoiceTypeCode');
  if (type !== (kind === 'credit' ? '381' : '380'))
    throw Error('UBL : seuls Invoice 380 et CreditNote 381 sont pris en charge.');
  if (
    text(root, 'cbc', 'DocumentCurrencyCode') !== 'EUR' ||
    one(root, 'cbc', 'TaxCurrencyCode', false)
  )
    throw Error('UBL : devise EUR uniquement, sans devise comptable de TVA distincte.');
  const date = text(root, 'cbc', 'IssueDate'),
    originalId = text(root, 'cbc', 'ID');
  if (originalId.length > 256) throw Error('UBL : identifiant de facture trop long.');
  const party = one(one(root, 'cac', 'AccountingSupplierParty'), 'cac', 'Party');
  const country = text(
    one(one(party, 'cac', 'PostalAddress'), 'cac', 'Country'),
    'cbc',
    'IdentificationCode',
  );
  if (!/^[A-Z]{2}$/.test(country)) throw Error('UBL : code pays du fournisseur invalide.');
  const taxes = children(party, 'cac', 'PartyTaxScheme').filter(
    (n) => text(one(n, 'cac', 'TaxScheme'), 'cbc', 'ID') === 'VAT',
  );
  if (taxes.length > 1) throw Error('UBL : identifiant TVA du fournisseur ambigu.');
  const companyId = (
    taxes.length
      ? text(taxes[0], 'cbc', 'CompanyID')
      : text(one(party, 'cac', 'PartyLegalEntity'), 'cbc', 'CompanyID')
  ).replace(/\s+/g, '');
  const totals = children(root, 'cac', 'TaxTotal');
  if (totals.length !== 1) throw Error('UBL : un seul total de TVA en EUR est requis.');
  const taxTotal = money(totals[0], 'TaxAmount'),
    parts = children(totals[0], 'cac', 'TaxSubtotal');
  if (!parts.length || parts.length > 20)
    throw Error('UBL : ventilation de TVA absente ou trop complexe.');
  const grouped = new Map(),
    categories = new Set();
  let sum = 0;
  const seen = new Set();
  for (const part of parts) {
    const cat = one(part, 'cac', 'TaxCategory'),
      code = text(cat, 'cbc', 'ID');
    if (text(one(cat, 'cac', 'TaxScheme'), 'cbc', 'ID') !== 'VAT')
      throw Error('UBL : taxe différente de la TVA non prise en charge.');
    const rate = decimal(text(cat, 'cbc', 'Percent', false) || '0', 2, 'taux');
    if (
      !['S', 'E', 'Z', 'AE', 'G'].includes(code) ||
      (code === 'S' ? rate === 0 || !VAT_RATES.includes(rate) : rate !== 0)
    )
      throw Error(
        'UBL : catégorie ou taux TVA hors périmètre. Catégories S, E, Z, AE et G ; taux 20 %, 10 %, 5,5 %, 2,1 % et postes sans TVA uniquement.',
      );
    const key = code + ':' + rate;
    if (seen.has(key)) throw Error('UBL : ventilation de TVA dupliquée.');
    seen.add(key);
    categories.add(code);
    const netCents = money(part, 'TaxableAmount'),
      vatCents = money(part, 'TaxAmount');
    if (rate === 0 && vatCents !== 0)
      throw Error('UBL : une catégorie sans TVA facturée doit avoir un montant de TVA nul.');
    const previous = grouped.get(rate) ?? { rateBps: rate, netCents: 0, vatCents: 0 };
    previous.netCents += netCents;
    previous.vatCents += vatCents;
    grouped.set(rate, previous);
    sum += vatCents;
  }
  if (sum !== taxTotal) throw Error('UBL : total de TVA incohérent avec sa ventilation.');
  let reference;
  if (kind === 'credit') {
    const refs = children(root, 'cac', 'BillingReference')
      .map((n) => one(n, 'cac', 'InvoiceDocumentReference', false))
      .filter(Boolean);
    if (refs.length !== 1)
      throw Error('UBL : l’avoir doit référencer une seule facture d’origine.');
    const ref = text(refs[0], 'cbc', 'ID');
    if (ref === originalId || ref.length > 256) throw Error('UBL : référence d’avoir invalide.');
    reference = await invoiceId(companyId, ref, 'invoice');
  }
  const invoice = {
    id: await invoiceId(companyId, originalId, kind),
    date,
    kind,
    ...(reference ? { reference } : {}),
    ...(grouped.has(0)
      ? {
          exemptionReason:
            'UBL catégories ' +
            [...categories]
              .filter((c) => c !== 'S')
              .sort()
              .join('/') +
            ' : motifs conservés dans le XML certifié.',
        }
      : {}),
    lines: [...grouped.values()].sort((a, b) => a.rateBps - b.rateBps),
  };
  return { companyId, invoice, originalId, profile };
}
export function ublDraft(records, periodStart, periodEnd) {
  if (!records.length || records.length > UBL_LIMITS.files)
    throw Error('Sélectionnez entre 1 et 500 factures UBL.');
  const companyId = records[0].companyId;
  if (records.some((r) => r.companyId !== companyId))
    throw Error(
      'UBL : toutes les pièces doivent concerner le même fournisseur, identifié de manière homogène.',
    );
  try {
    return vatSummary({
      format: 'clair-vat-draft/1',
      companyId,
      periodStart,
      periodEnd,
      invoices: records.map((r) => r.invoice),
    }).draft;
  } catch (e) {
    throw Error(
      'Lot UBL incompatible avec le circuit TVA : ' +
        e.message +
        ' Aucun montant source n’a été corrigé.',
      { cause: e },
    );
  }
}
