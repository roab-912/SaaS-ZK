import { generateKeyPairSync } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import SaxonJS from 'saxon-js';
import { Noir } from '@noir-lang/noir_js';
import { createUblValidator } from '../src/lib/ubl-validation.js';
import { importUblFiles } from '../src/features/vat/ubl-import.js';
import { makeUblExamples } from '../shared/ubl-examples.mjs';
import { signVatUblBatch, vatCircuit, vatPublicValues } from '../shared/vat.mjs';
import { createTrustSnapshot } from '../shared/trust-snapshot.mjs';
import { prepareVatDraft } from '../zk/noir/vat-runtime.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';
import { createNoirNode } from '../zk/noir/node.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { executeZkOperation } from '../zk/operations.mjs';
import { OFFLINE_LAUNCHER, offlineRelease } from '../server/offline-bundle.mjs';
import { fixtureReference } from './vat-demo-fixtures.mjs';
import { publishVatDemo } from './publish-vat-demo.mjs';

// A new directory and a new fictional signing key isolate every rehearsal.
const count = Number(process.argv[2] ?? 100);
if (![100, 500].includes(count)) throw Error('Choisissez un lot de 100 ou 500 pièces.');
const root = resolve('data/demo-tva-hors-ligne');
await mkdir(root, { recursive: true });
const kit = await mkdtemp(join(root, 'session-'));
const agent = join(kit, 'administration');
const company = join(kit, 'entreprise');
await mkdir(agent);
await mkdir(company);
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const source = {
  id: 'demo-tva',
  name: 'Plateforme de démonstration',
  jwk: publicKey.export({ format: 'jwk' }),
};
const snapshot = await createTrustSnapshot([source], 'https://demo.invalid');
const now = new Date();
const year = now.getUTCFullYear() - (now.getUTCMonth() < 2 ? 1 : 0);
const circuit = vatCircuit(count);
const compiled = await compileNoir(circuit);
const crsPath = resolve(process.env.CLAIR_DEMO_CRS_PATH || 'data/offline-cache');
const registry = createEngineRegistry([createNoirNode({ crsPath, Noir })], ['prove', 'verify']);
const Parser = new JSDOM('').window.DOMParser;
const validator = createUblValidator({
  Parser,
  loadSaxon: async () => SaxonJS,
  loadJson: async (name) =>
    JSON.parse(gunzipSync(await readFile(join('public/ubl', name))).toString('utf8')),
});
console.log('Préparation de la démonstration dans ' + kit);
try {
  for (const [month, label] of [
    ['01', 'janvier'],
    ['02', 'fevrier'],
  ]) {
    const periodStart = year + '-' + month + '-01';
    const periodEnd = new Date(Date.UTC(year, Number(month), 0)).toISOString().slice(0, 10);
    console.log('Validation des ' + count + ' XML de ' + label);
    const files = makeUblExamples({
      count,
      peppol: true,
      periodStart,
      periodEnd,
      idPrefix: 'DEMO-' + month + '-',
    });
    const reference = fixtureReference(files);
    const { draft, documents } = await importUblFiles(
      files.map(({ name, bytes }) => ({
        name,
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer,
      })),
      { periodStart, periodEnd, validator, Parser },
    );
    const commitment = await prepareVatDraft(draft);
    const batch = await signVatUblBatch({
      draft,
      documents,
      commitment,
      source,
      privateKey: privateKey.export({ format: 'jwk' }),
    });
    const proof = await executeZkOperation(
      {
        mode: 'prove',
        circuit,
        compiled,
        vatBatch: batch,
        values: vatPublicValues(batch),
        issuers: [source],
      },
      registry,
      (msg) => console.log(label + ' — ' + msg),
    );
    const fields = Object.fromEntries(proof.publicData.map(({ id, value }) => [id, value]));
    if (
      fields.sales_vat !== reference.salesVatCents ||
      fields.credit_vat !== reference.creditVatCents
    )
      throw Error('Les totaux de la preuve diffèrent des XML de référence.');
    await writeFile(join(agent, label + '.preuve.clair'), JSON.stringify(proof));
    await writeFile(join(company, label + '.originaux.clair'), JSON.stringify(batch));
    console.log(label + ' — ' + reference.netVatCents + ' centimes');
  }
} finally {
  await validator.dispose();
}
if (!(await offlineRelease()).available)
  throw Error('Construisez le vérificateur avec npm run build:offline.');
await copyFile(resolve('data/offline/logiciel.zip'), join(agent, 'logiciel.zip'));
await writeFile(join(agent, 'demarrer.cmd'), OFFLINE_LAUNCHER);
await writeFile(join(agent, 'sources.clair'), JSON.stringify(snapshot));
await writeFile(
  join(agent, 'demande.txt'),
  [
    'Exercice fictif — demande du destinataire',
    'Entreprise A : FR00000000000',
    'Période : janvier ' + year,
    'Source attendue : ' + source.name + ' (' + source.id + ')',
    'Empreinte de sa clé : ' + snapshot.issuers[0].keyHash,
    'Programme TVA v2 · ' + count + ' pièces · empreinte : ' + compiled.hash,
  ].join('\r\n'),
);
console.log('Kit prêt. Transférez uniquement le dossier ' + agent + ' pour le contrôle ordinaire.');
await publishVatDemo(kit);
