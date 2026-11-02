import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { makeUblExamples } from '../shared/ubl-examples.mjs';

export const DEMO_COUNTS = [10, 100, 500];
export function invoiceErrors(files) {
  const invoice = files.find((f) => new TextDecoder().decode(f.bytes).includes('<Invoice '));
  if (!invoice) throw Error('Une facture Invoice est requise pour les exemples d’erreurs.');
  const source = new TextDecoder().decode(invoice.bytes);
  return [
    {
      id: 'xml-total-incoherent',
      name: '01-total-incoherent.xml',
      text: source.replace(/(<cbc:PayableAmount[^>]*>)[^<]+/, (_, p) => p + '0.01'),
      expected: 'BR-',
      reason:
        'Le montant à payer contredit les totaux de la facture : rejet par les règles UBL/EN 16931.',
    },
    {
      id: 'xml-hors-periode',
      name: '02-hors-periode.xml',
      text: source.replace(
        '<cbc:IssueDate>2026-09-01</cbc:IssueDate>',
        '<cbc:IssueDate>2026-08-31</cbc:IssueDate>',
      ),
      expected: 'période',
      reason:
        'Le document reste un exemple XML, mais sa date ne fait pas partie du relevé de septembre.',
    },
  ];
}
export async function prepareVatDemo(root = resolve('data/demo-tva'), counts = DEMO_COUNTS) {
  if (
    !counts.length ||
    counts.some((n) => !DEMO_COUNTS.includes(n)) ||
    new Set(counts).size !== counts.length
  )
    throw Error('Volumes autorisés : 10, 100, 500, sans doublon.');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, new Date().toISOString().replaceAll(':', '-') + '-'));
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
    jwk = pair.publicKey.export({ format: 'jwk' });
  const publicKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    privateKey = { ...publicKey, d: pair.privateKey.export({ format: 'jwk' }).d };
  const config = {
    format: 'clair-vat-demo/1',
    fictitious: true,
    createdAt: new Date().toISOString(),
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    counts,
    source: { id: 'demo-tva', name: 'Facturation fictive — démonstration Clair' },
    credentials: {
      user: {
        email: 'entreprise@demo.example.test',
        password: 'Clair-demo-' + randomBytes(18).toString('base64url'),
      },
      admin: {
        email: 'autorite@demo.example.test',
        password: 'Clair-demo-' + randomBytes(18).toString('base64url'),
      },
    },
  };
  await mkdir(join(directory, 'source'));
  await writeFile(
    join(directory, 'source', 'demo-tva.cle-publique.clair'),
    JSON.stringify(publicKey, null, 2),
  );
  await writeFile(
    join(directory, 'source', 'demo-tva.cle-privee.clair'),
    JSON.stringify(privateKey, null, 2),
    { mode: 0o600 },
  );
  await writeFile(join(directory, 'demo-config.json'), JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
  for (const count of counts) {
    const target = join(directory, 'lots', String(count), 'xml');
    await mkdir(target, { recursive: true });
    const files = makeUblExamples({
      count,
      peppol: true,
      periodStart: config.periodStart,
      periodEnd: config.periodEnd,
    });
    for (const file of files) await writeFile(join(target, file.name), file.bytes);
  }
  await mkdir(join(directory, 'erreurs'));
  const errors = invoiceErrors(makeUblExamples({ count: 10, peppol: true }));
  for (const error of errors) await writeFile(join(directory, 'erreurs', error.name), error.text);
  await writeFile(
    join(directory, 'erreurs', 'EXPLICATIONS.md'),
    '# Erreurs volontaires\n\n' +
      errors
        .map(
          (e) => '## ' + e.name + '\n\n' + e.reason + '\n\nMessage attendu : ' + e.expected + '.',
        )
        .join('\n\n') +
      '\n',
  );
  return { directory, config, publicKey };
}
export async function loadVatDemo(directory) {
  const target = resolve(directory),
    config = JSON.parse(await readFile(join(target, 'demo-config.json'), 'utf8'));
  if (
    config.format !== 'clair-vat-demo/1' ||
    config.fictitious !== true ||
    config.source?.id !== 'demo-tva'
  )
    throw Error('Ce dossier ne contient pas un kit TVA fictif reconnu.');
  return { directory: target, config };
}
export async function latestVatDemo() {
  const latest = JSON.parse(await readFile(resolve('data/demo-tva/latest.json'), 'utf8'));
  return resolve(latest.directory);
}

export function fixtureReference(files) {
  let salesVatCents = 0,
    creditVatCents = 0,
    invoices = 0,
    credits = 0;
  for (const file of files) {
    const xml = new TextDecoder().decode(file.bytes);
    const amount = xml.match(
      /<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">(\d+)\.(\d{2})<\/cbc:TaxAmount>/,
    );
    if (!amount) throw Error('Total de référence absent du XML fictif.');
    const cents = Number(amount[1]) * 100 + Number(amount[2]);
    if (xml.includes('<CreditNote ')) {
      creditVatCents += cents;
      credits++;
    } else if (xml.includes('<Invoice ')) {
      salesVatCents += cents;
      invoices++;
    } else throw Error('Type de pièce fictive inconnu.');
  }
  return {
    count: files.length,
    invoices,
    credits,
    salesVatCents,
    creditVatCents,
    netVatCents: salesVatCents - creditVatCents,
  };
}
