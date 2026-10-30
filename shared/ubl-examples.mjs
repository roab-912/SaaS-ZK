import { UBL_NS, UBL_CORE, UBL_PEPPOL, UBL_LIMITS } from './ubl.mjs';
import { makeVatExample } from './vat.mjs';
function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
const amount = (cents) => (cents / 100).toFixed(2);
export function makeUblExamples({
  count = 2,
  periodStart = '2026-09-01',
  periodEnd = '2026-09-30',
  peppol = false,
} = {}) {
  if (!Number.isInteger(count) || count < 1 || count > UBL_LIMITS.files)
    throw Error('Choisissez entre 1 et 500 exemples UBL.');
  makeVatExample('UBL-DEMO', periodStart, periodEnd, 1);
  let previous = 'DEMO-FA-000001';
  return Array.from({ length: count }, (_, n) => {
    const credit = n > 0 && (n % 10 === 9 || n === count - 1),
      id = 'DEMO-' + (credit ? 'AV-' : 'FA-') + String(n + 1).padStart(6, '0');
    const root = credit ? 'CreditNote' : 'Invoice',
      line = credit ? 'CreditNoteLine' : 'InvoiceLine',
      quantity = credit ? 'CreditedQuantity' : 'InvoicedQuantity';
    const bases = credit ? [1000, 500] : [10000 + n * 100, 2500];
    const rates = [20, 5.5],
      taxes = bases.map((b, i) => Math.round((b * rates[i]) / 100)),
      net = bases.reduce((a, b) => a + b, 0),
      vat = taxes.reduce((a, b) => a + b, 0);
    const supplier = (role, name, vatId) =>
      `<cac:${role}><cac:Party><cbc:EndpointID schemeID="0002">000000000</cbc:EndpointID><cac:PartyName><cbc:Name>${name}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>1 rue de la Démonstration</cbc:StreetName><cbc:CityName>Paris</cbc:CityName><cbc:PostalZone>75001</cbc:PostalZone><cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>${vatId}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${name}</cbc:RegistrationName><cbc:CompanyID schemeID="0002">000000000</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:${role}>`;
    const category = (i) =>
      `<cbc:ID>S</cbc:ID><cbc:Percent>${rates[i]}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="${credit ? UBL_NS.credit : UBL_NS.invoice}" xmlns:cac="${UBL_NS.cac}" xmlns:cbc="${UBL_NS.cbc}">
<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>${peppol ? UBL_PEPPOL : UBL_CORE}</cbc:CustomizationID>
${peppol ? '<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>' : ''}
<cbc:ID>${id}</cbc:ID><cbc:IssueDate>${esc(credit ? periodEnd : periodStart)}</cbc:IssueDate>
${credit ? '' : '<cbc:DueDate>' + esc(periodEnd) + '</cbc:DueDate>'}
<cbc:${credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${credit ? '381' : '380'}</cbc:${credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>
<cbc:Note>Exemple fictif, sans opération réelle.</cbc:Note><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cbc:BuyerReference>DEMO-COMMANDE</cbc:BuyerReference>
${credit ? '<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>' + previous + '</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>' : ''}
${supplier('AccountingSupplierParty', 'Fournisseur de démonstration', 'FR00000000000')}
${supplier('AccountingCustomerParty', 'Client de démonstration', 'FR11111111111')}
<cac:PaymentTerms><cbc:Note>Exemple de paiement à échéance.</cbc:Note></cac:PaymentTerms>
<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${amount(vat)}</cbc:TaxAmount>
${bases.map((b, i) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${amount(b)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${amount(taxes[i])}</cbc:TaxAmount><cac:TaxCategory>${category(i)}</cac:TaxCategory></cac:TaxSubtotal>`).join('')}
</cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${amount(net)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${amount(net)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${amount(net + vat)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${amount(net + vat)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
${bases.map((b, i) => `<cac:${line}><cbc:ID>${i + 1}</cbc:ID><cbc:${quantity} unitCode="C62">1</cbc:${quantity}><cbc:LineExtensionAmount currencyID="EUR">${amount(b)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>Article de démonstration ${i + 1}</cbc:Name><cac:ClassifiedTaxCategory>${category(i)}</cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${amount(b)}</cbc:PriceAmount></cac:Price></cac:${line}>`).join('')}
</${root}>`;
    if (!credit) previous = id;
    return { name: id + '.xml', bytes: new TextEncoder().encode(xml) };
  });
}
