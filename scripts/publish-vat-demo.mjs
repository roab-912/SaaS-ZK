import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateTrustSnapshot } from '../shared/trust-snapshot.mjs';
import { parseProof } from '../shared/proof.mjs';
import { parseVatBatch, vatPublicValues, verifyVatManifest } from '../shared/vat.mjs';
import { verifyOriginalsAgainstManifest } from '../shared/vat-originals.mjs';
import { makeUblExamples } from '../shared/ubl-examples.mjs';
import { OFFLINE_LAUNCHER } from '../server/offline-bundle.mjs';

// Only generated fixtures may be published. Never serve the kit directory itself.
export async function publishVatDemo(kit) {
  const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const admin = join(kit, 'administration');
  const snapshot = await validateTrustSnapshot(await readJson(join(admin, 'sources.clair')));
  if (
    snapshot.origin !== 'https://demo.invalid' ||
    snapshot.issuers.length !== 1 ||
    snapshot.issuers[0].id !== 'demo-tva'
  )
    throw Error('Ce registre ne correspond pas à la source fictive de la démonstration.');
  const files = [];
  let january, expiresAt, netCents;
  for (const [name, month] of [
    ['janvier', '01'],
    ['fevrier', '02'],
  ]) {
    const proof = parseProof(await readJson(join(admin, name + '.preuve.clair')));
    const batch = parseVatBatch(await readJson(join(kit, 'entreprise', name + '.originaux.clair')));
    const manifest = proof.vatManifest;
    if (
      manifest?.companyId !== 'FR00000000000' ||
      ![100, 500].includes(manifest.count) ||
      proof.circuit.vat?.capacity !== manifest.count ||
      proof.circuit.vat?.programVersion !== 2 ||
      manifest.periodStart.slice(5) !== month + '-01' ||
      !(await verifyVatManifest(manifest, snapshot.issuers)).valid
    )
      throw Error('Relevé de démonstration incompatible ou expiré.');
    await verifyOriginalsAgainstManifest(batch, manifest);
    const examples = makeUblExamples({
      count: manifest.count,
      peppol: true,
      periodStart: manifest.periodStart,
      periodEnd: manifest.periodEnd,
      idPrefix: 'DEMO-' + month + '-',
    });
    if (
      !examples.every(
        ({ bytes, name }, i) =>
          batch.documents[i].content === Buffer.from(bytes).toString('base64') &&
          batch.documents[i].name === name,
      )
    )
      throw Error('Seuls les XML fictifs du générateur peuvent être distribués.');
    files.push([name + '.preuve.json', proof], [name + '.originaux.json', batch]);
    const { sales_vat, credit_vat } = vatPublicValues(batch);
    if (month === '01') {
      january = manifest;
      netCents = sales_vat - credit_vat;
    } else if (manifest.count !== january.count || sales_vat - credit_vat !== netCents) {
      throw Error('Les deux mois de démonstration doivent avoir le même volume et le même total.');
    }
    expiresAt = !expiresAt || manifest.expiresAt < expiresAt ? manifest.expiresAt : expiresAt;
  }
  const root = resolve('public/demo-tva');
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(join(root, 'kit-'));
  const id = basename(folder);
  for (const name of ['g1.dat', 'g2.dat'])
    await copyFile(resolve('data/offline-cache', 'bn254_' + name), join(folder, name));
  for (const [name, data] of files) await writeFile(join(folder, name), JSON.stringify(data));
  // Reuse the exact public software and trust snapshot paired with this exercise.
  if ((await readFile(join(admin, 'demarrer.cmd'), 'utf8')) !== OFFLINE_LAUNCHER)
    throw Error('Lanceur du kit inattendu.');
  await promisify(execFile)(
    'tar.exe',
    [
      '-a',
      '-cf',
      join(folder, 'verificateur.zip'),
      '-C',
      admin,
      'logiciel.zip',
      'demarrer.cmd',
      'sources.clair',
      'demande.txt',
    ],
    { windowsHide: true, timeout: 300000 },
  );
  const descriptor = {
    id,
    company: january.companyId,
    count: january.count,
    netCents,
    month: january.periodStart.slice(0, 7),
    source: snapshot.issuers[0],
    januarySignature: january.signature,
    expiresAt,
  };
  const pending = join(root, id + '.tmp');
  await writeFile(pending, JSON.stringify(descriptor));
  await rename(pending, join(root, 'session.json'));
  console.log('Guide prêt sur /?view=demo-tva');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!/^session-[A-Za-z0-9]+$/.test(process.argv[2] ?? ''))
    throw Error('Indiquez le nom de la session de démonstration.');
  await publishVatDemo(resolve('data/demo-tva-hors-ligne', process.argv[2]));
}
