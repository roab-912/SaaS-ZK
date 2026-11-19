const ubl = 'urn:oasis:names:specification:ubl:schema:xsd:';
const basic = ubl + 'CommonBasicComponents-2';
const aggregate = ubl + 'CommonAggregateComponents-2';

function children(parent, name, namespace = aggregate) {
  return Array.from(parent?.children ?? []).filter(
    (node) => node.namespaceURI === namespace && node.localName === name,
  );
}
const group = (parent, name) => children(parent, name)[0];
const field = (parent, name) => children(parent, name, basic)[0]?.textContent.trim() ?? '';

function add(parent, tag, value) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  parent.append(node);
  return node;
}

function amount(parent, name) {
  const node = children(parent, name, basic)[0];
  if (!node) return '';
  const value = node.textContent.trim().split('.');
  const whole = value[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const currency = node.getAttribute('currencyID');
  return [value.length === 2 ? whole + ',' + value[1] : whole, currency === 'EUR' ? '€' : currency]
    .filter(Boolean)
    .join(' ');
}

function party(parent, role, title) {
  const data = group(group(parent, role), 'Party');
  const box = document.createElement('div');
  add(box, 'h4', title);
  add(
    box,
    'strong',
    field(group(data, 'PartyLegalEntity'), 'RegistrationName') ||
      field(group(data, 'PartyName'), 'Name') ||
      '—',
  );
  const address = group(data, 'PostalAddress');
  const city = [field(address, 'PostalZone'), field(address, 'CityName')].filter(Boolean).join(' ');
  const location = [
    field(address, 'StreetName'),
    city,
    field(group(address, 'Country'), 'IdentificationCode'),
  ]
    .filter(Boolean)
    .join(', ');
  if (location) add(box, 'p', location);
  const vat = children(data, 'PartyTaxScheme').find(
    (scheme) => field(group(scheme, 'TaxScheme'), 'ID') === 'VAT',
  );
  if (field(vat, 'CompanyID')) add(box, 'p', 'N° de TVA · ' + field(vat, 'CompanyID'));
  return box;
}

function table(parent, title, headers, rows) {
  if (!rows.length) return;
  const wrap = add(parent, 'div');
  wrap.className = 'invoice-table';
  const table = add(wrap, 'table');
  add(table, 'caption', title);
  const header = add(add(table, 'thead'), 'tr');
  for (const label of headers) add(header, 'th', label).scope = 'col';
  const body = add(table, 'tbody');
  for (const values of rows) {
    const row = add(body, 'tr');
    for (const value of values) add(row, 'td', value || '—');
  }
}

export function showInvoice(parent, source) {
  const xml = /<!DOCTYPE/i.test(source)
    ? null
    : new DOMParser().parseFromString(source, 'application/xml').documentElement;
  const credit = xml?.localName === 'CreditNote';
  if (
    !xml ||
    (!credit && xml.localName !== 'Invoice') ||
    xml.namespaceURI !== ubl + xml.localName + '-2'
  ) {
    add(
      parent,
      'p',
      'Aperçu indisponible pour cette pièce. Vous pouvez consulter son XML original.',
    );
    return;
  }
  add(parent, 'h3', (credit ? 'Avoir' : 'Facture') + ' ' + field(xml, 'ID'));
  const issued = field(xml, 'IssueDate').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
  if (issued) add(parent, 'p', 'Date d’émission · ' + issued);
  for (const reference of children(xml, 'BillingReference')) {
    const id = field(group(reference, 'InvoiceDocumentReference'), 'ID');
    if (id) add(parent, 'p', 'Facture de référence · ' + id);
  }
  const parties = add(parent, 'div');
  parties.className = 'invoice-parties';
  parties.append(
    party(xml, 'AccountingSupplierParty', 'Fournisseur'),
    party(xml, 'AccountingCustomerParty', 'Client'),
  );

  const lines = children(xml, credit ? 'CreditNoteLine' : 'InvoiceLine');
  table(
    parent,
    credit ? 'Lignes de l’avoir' : 'Lignes de la facture',
    ['Désignation', 'Quantité', 'Montant HT'],
    lines.map((line) => {
      const item = group(line, 'Item');
      const quantity = children(line, credit ? 'CreditedQuantity' : 'InvoicedQuantity', basic)[0];
      return [
        field(item, 'Name') || field(item, 'Description') || field(line, 'ID'),
        [
          quantity?.textContent.trim().replace('.', ','),
          quantity?.getAttribute('unitCode') === 'C62' ? '' : quantity?.getAttribute('unitCode'),
        ]
          .filter(Boolean)
          .join(' '),
        amount(line, 'LineExtensionAmount'),
      ];
    }),
  );

  const currency = field(xml, 'DocumentCurrencyCode');
  const taxes = children(xml, 'TaxTotal').find(
    (total) => children(total, 'TaxAmount', basic)[0]?.getAttribute('currencyID') === currency,
  );
  table(
    parent,
    'Détail de la TVA',
    ['Catégorie', 'Taux', 'Base HT', 'TVA'],
    children(taxes, 'TaxSubtotal').map((subtotal) => {
      const category = group(subtotal, 'TaxCategory');
      const rate = field(category, 'Percent');
      return [
        field(category, 'ID'),
        rate && rate.replace('.', ',') + ' %',
        amount(subtotal, 'TaxableAmount'),
        amount(subtotal, 'TaxAmount'),
      ];
    }),
  );
  const monetary = group(xml, 'LegalMonetaryTotal');
  const totals = add(parent, 'dl');
  for (const [label, value] of [
    ['Total HT', amount(monetary, 'TaxExclusiveAmount')],
    ['TVA', amount(taxes, 'TaxAmount')],
    ['Total TTC', amount(monetary, 'TaxInclusiveAmount')],
    [credit ? 'Montant de l’avoir à régler' : 'Net à payer', amount(monetary, 'PayableAmount')],
  ]) {
    if (value) {
      add(totals, 'dt', label);
      add(totals, 'dd', value);
    }
  }
}
