import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { zipSync } from 'fflate';
import { prepareVatDemo, DEMO_COUNTS, fixtureReference } from './vat-demo-fixtures.mjs';
import { startVatDemo } from './vat-demo-server.mjs';
import {
  measurementEnvironment,
  writeBenchmarkReport,
  kitReadme,
  copyClientDocuments,
} from './vat-demo-report.mjs';
import { circuitHash } from '../shared/circuit.mjs';
import { vatCircuit, vatCapacity, vatSummary, vatDraftFromBatch } from '../shared/vat.mjs';

export function benchmarkOptions(args) {
  const runsArg = args.find((a) => a.startsWith('--runs=')),
    countsArg = args.find((a) => a.startsWith('--counts='));
  if (args.some((a) => !a.startsWith('--runs=') && !a.startsWith('--counts=')))
    throw Error('Options : --runs=1..5 et --counts=10,100,500.');
  const repetitions = runsArg ? Number(runsArg.slice(7)) : 3,
    counts = countsArg ? countsArg.slice(9).split(',').map(Number) : DEMO_COUNTS;
  if (
    !Number.isInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > 5 ||
    !counts.length ||
    counts.some((n) => !DEMO_COUNTS.includes(n)) ||
    new Set(counts).size !== counts.length
  )
    throw Error('Options de mesure invalides.');
  return { repetitions, counts };
}
async function waitBudget(request, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request.get(url + '/api/session'),
      value = response.headers().ratelimit ?? '';
    const remaining = Number(/r=(\d+)/.exec(value)?.[1]),
      reset = Number(/t=(\d+)/.exec(value)?.[1]);
    if (response.ok() && remaining >= 30) return;
    const seconds = Number.isFinite(reset) ? Math.min(60, reset + 1) : 60;
    console.log('Attente du budget API : ' + seconds + ' s.');
    await new Promise((r) => setTimeout(r, seconds * 1000));
  }
  throw Error('Budget de requêtes de démonstration indisponible.');
}
async function login(context, url, credentials) {
  const response = await context.request.post(url + '/api/auth/login', {
    headers: { Origin: url },
    data: credentials,
  });
  if (!response.ok())
    throw Error('Connexion du compte de démonstration impossible : ' + response.status());
}
async function arm(locator, name, event, expected) {
  await locator.evaluate(
    (element, { name, event, expected }) => {
      window.__clairDemoTimers ??= {};
      element.addEventListener(
        event,
        () => {
          const start = performance.now();
          const observer = new MutationObserver(() => {
            const done = [
              ...document.querySelectorAll(
                'main h1,main h2,main h3,main h4,main strong,main label',
              ),
            ].some((node) => node.textContent.trim() === expected);
            if (done) {
              window.__clairDemoTimers[name] = performance.now() - start;
              observer.disconnect();
            }
          });
          observer.observe(document.querySelector('main'), {
            subtree: true,
            childList: true,
            characterData: true,
          });
        },
        { once: true, capture: true },
      );
    },
    { name, event, expected },
  );
}
async function duration(page, name) {
  await page.waitForFunction((name) => Number.isFinite(window.__clairDemoTimers?.[name]), name, {
    timeout: 360000,
  });
  return (
    Math.round((await page.evaluate((name) => window.__clairDemoTimers[name], name)) * 1000) / 1000
  );
}
async function downloadText(page, button) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  let text = '';
  for await (const chunk of await file.createReadStream()) text += chunk;
  return text;
}
function watchPrivacy(page, privateScalar, report) {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname))
      report.externalDomains.add(url.hostname);
    if (url.pathname.startsWith('/api/')) {
      const body = request.postData() ?? '';
      if (
        ['<?xml', '<Invoice', 'netCents', 'DEMO-FA-', privateScalar].some((marker) =>
          body.includes(marker),
        )
      )
        report.privateDataTransmitted = true;
    }
  });
}
async function enterVat(page, url) {
  await page.goto(url + '/?view=circuits');
  await page.getByRole('button', { name: 'Utiliser TVA collectée', exact: true }).click();
}
async function uploadBatch(page, batch, name = 'lot.clair') {
  await page.getByText('J’ai déjà un lot signé', { exact: true }).click();
  await page.getByLabel('Lot de factures certifié', { exact: true }).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(batch)),
  });
}
async function verifyFile(page, text, name = 'preuve.clair') {
  await page
    .getByLabel('Fichier de preuve')
    .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
}
async function runVolume({ browser, runtime, fixture, count, repetition, report }) {
  const context = await browser.newContext({ viewport: report.environment.viewport });
  const privateText = await readFile(
    join(fixture.directory, 'source/demo-tva.cle-privee.clair'),
    'utf8',
  );
  try {
    await waitBudget(context.request, runtime.url);
    await login(context, runtime.url, fixture.config.credentials.user);
    const page = await context.newPage();
    watchPrivacy(page, JSON.parse(privateText).d, report);
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await enterVat(page, runtime.url);
    await page.getByRole('button', { name: 'Importer mes factures XML' }).click();
    await page.getByLabel('Début de période', { exact: true }).fill('01/09/2026');
    await page.getByLabel('Fin de période', { exact: true }).fill('30/09/2026');
    const xmlDirectory = join(fixture.directory, 'lots', String(count), 'xml'),
      paths = (await readdir(xmlDirectory)).sort().map((name) => join(xmlDirectory, name));
    const input = page.getByLabel('Importer des factures UBL', { exact: true });
    await arm(input, 'import', 'change', count + ' factures et avoirs prêts');
    await input.setInputFiles(paths);
    await expect(page.getByText(count + ' factures et avoirs prêts', { exact: true })).toBeVisible({
      timeout: 180000,
    });
    const importMs = await duration(page, 'import');
    await page.getByRole('button', { name: 'Continuer vers la signature' }).click();
    await page.getByRole('checkbox').check();
    await page
      .getByLabel('Importer la clé privée TVA')
      .setInputFiles(join(fixture.directory, 'source/demo-tva.cle-privee.clair'));
    const sign = page.getByRole('button', { name: 'Signer le relevé complet' });
    await arm(sign, 'sign', 'click', 'Lot certifié prêt');
    await sign.click();
    await expect(page.getByRole('heading', { name: 'Lot certifié prêt' })).toBeVisible({
      timeout: 90000,
    });
    const signMs = await duration(page, 'sign');
    const batchText = await downloadText(
        page,
        page.getByRole('button', { name: 'Télécharger le lot certifié' }),
      ),
      batch = JSON.parse(batchText);
    const totals = vatSummary(vatDraftFromBatch(batch));
    if (batch.documents.length !== count) throw Error('Lot signé incomplet.');
    const next = page.getByRole('button', { name: 'Continuer vers ma preuve' });
    await arm(next, 'loadSigned', 'click', 'TVA collectée en euros');
    await next.click();
    await expect(page.getByLabel('TVA collectée en euros')).toBeVisible({ timeout: 90000 });
    const loadSignedMs = await duration(page, 'loadSigned');
    const generate = page.getByRole('button', { name: 'Générer la preuve TVA' });
    await arm(generate, 'generate', 'click', 'Preuve TVA prête');
    await generate.click();
    await expect(page.getByRole('heading', { name: 'Preuve TVA prête' })).toBeVisible({
      timeout: 330000,
    });
    const generateMs = await duration(page, 'generate');
    const proofText = await downloadText(
        page,
        page.getByRole('button', { name: 'Télécharger la preuve TVA' }),
      ),
      proof = JSON.parse(proofText);
    if (
      proof.vatManifest.documentsRoot !== batch.manifest.documentsRoot ||
      proofText.includes('DEMO-FA-') ||
      proofText.includes(batch.documents[0].content) ||
      proofText.includes(JSON.parse(privateText).d)
    )
      throw Error('Contenu public de la preuve incorrect.');
    const target = join(fixture.directory, 'lots', String(count));
    await writeFile(join(target, 'lot-conforme.lot-tva.clair'), batchText);
    await writeFile(join(target, 'preuve-valide.preuve.clair'), proofText);
    await page.screenshot({
      path: join(target, 'preuve-generee.png'),
      fullPage: true,
      animations: 'disabled',
    });
    const verifierContext = await browser.newContext({ viewport: report.environment.viewport });
    let verifyMs;
    try {
      const verifier = await verifierContext.newPage();
      watchPrivacy(verifier, JSON.parse(privateText).d, report);
      await verifier.goto(runtime.url + '/?view=verify');
      await verifier
        .getByLabel('Fichier de preuve')
        .setInputFiles(join(target, 'preuve-valide.preuve.clair'));
      const verify = verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true });
      await arm(verify, 'verify', 'click', 'Preuve valide');
      await verify.click();
      await expect(verifier.getByText('Preuve valide', { exact: true })).toBeVisible({
        timeout: 90000,
      });
      verifyMs = await duration(verifier, 'verify');
      await expect(verifier.getByText('Calcul et source vérifiés', { exact: true })).toBeVisible();
      await verifier.screenshot({
        path: join(target, 'preuve-verifiee.png'),
        fullPage: true,
        animations: 'disabled',
      });
    } finally {
      await verifierContext.close();
    }
    if (pageErrors.length) throw Error('Erreur navigateur : ' + pageErrors.join('; '));
    const row = {
      count,
      repetition,
      importMs,
      signMs,
      loadSignedMs,
      generateMs,
      verifyMs,
      proofBytes: Buffer.byteLength(proofText),
      proofValid: true,
      netVatCents: totals.net,
      salesVatCents: totals.sales,
      creditVatCents: totals.credits,
      circuitCapacity: proof.circuit.vat.capacity,
      crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
    };
    console.log(
      count +
        ' documents, passage ' +
        repetition +
        ' : import ' +
        (importMs / 1000).toFixed(2) +
        ' s, génération ' +
        (generateMs / 1000).toFixed(2) +
        ' s, preuve ' +
        row.proofBytes +
        ' octets.',
    );
    return row;
  } finally {
    await context.close();
  }
}
async function negativeCases({ browser, runtime, fixture, report }) {
  const count = fixture.config.counts[0],
    target = join(fixture.directory, 'lots', String(count)),
    batch = JSON.parse(await readFile(join(target, 'lot-conforme.lot-tva.clair'), 'utf8')),
    proofText = await readFile(join(target, 'preuve-valide.preuve.clair'), 'utf8');
  const context = await browser.newContext(),
    admin = await browser.newContext();
  const record = async (id, page) => {
    const observed = await page.locator('main').getByRole('alert').innerText();
    report.checks.push({ id, passed: true, observed });
    await page.screenshot({
      path: join(fixture.directory, 'erreurs', id + '.png'),
      fullPage: true,
      animations: 'disabled',
    });
  };
  try {
    await waitBudget(context.request, runtime.url);
    await login(context, runtime.url, fixture.config.credentials.user);
    await login(admin, runtime.url, fixture.config.credentials.admin);
    const page = await context.newPage();
    await enterVat(page, runtime.url);
    await page.getByRole('button', { name: 'Importer mes factures XML' }).click();
    await page.getByLabel('Début de période', { exact: true }).fill('01/09/2026');
    await page.getByLabel('Fin de période', { exact: true }).fill('30/09/2026');
    for (const [id, name, expected] of [
      ['xml-total-incoherent', '01-total-incoherent.xml', /BR-/],
      ['xml-hors-periode', '02-hors-periode.xml', /période/],
    ]) {
      await page
        .getByLabel('Importer des factures UBL', { exact: true })
        .setInputFiles(join(fixture.directory, 'erreurs', name));
      await expect(page.locator('main').getByRole('alert')).toContainText(expected, {
        timeout: 30000,
      });
      await record(id, page);
    }
    const missing = structuredClone(batch);
    missing.invoices = missing.invoices.slice(1);
    missing.documents = missing.documents.slice(1);
    const badSignature = structuredClone(batch);
    badSignature.manifest.signature =
      (badSignature.manifest.signature[0] === 'A' ? 'B' : 'A') +
      badSignature.manifest.signature.slice(1);
    for (const [id, bad, expected] of [
      ['lot-incomplet', missing, /nombre|manifeste|factures/i],
      ['signature-alteree', badSignature, /signature/i],
    ]) {
      await writeFile(
        join(fixture.directory, 'erreurs', id + '.lot-tva.clair'),
        JSON.stringify(bad, null, 2),
      );
      await enterVat(page, runtime.url);
      await uploadBatch(page, bad);
      await expect(page.locator('main').getByRole('alert')).toContainText(expected, {
        timeout: 30000,
      });
      await record(id, page);
    }
    await enterVat(page, runtime.url);
    await uploadBatch(page, batch);
    await expect(page.getByLabel('TVA collectée en euros')).toBeVisible({ timeout: 30000 });
    await page.getByLabel('TVA collectée en euros').fill('0,01');
    await page.getByRole('button', { name: 'Générer la preuve TVA' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('montant annoncé');
    await record('montant-annonce-incorrect', page);
    const verifierContext = await browser.newContext();
    try {
      const verifier = await verifierContext.newPage();
      await verifier.goto(runtime.url + '/?view=verify');
      const bad = JSON.parse(proofText);
      bad.proof = (bad.proof[0] === 'A' ? 'B' : 'A') + bad.proof.slice(1);
      await writeFile(
        join(fixture.directory, 'erreurs', 'preuve-alteree.preuve.clair'),
        JSON.stringify(bad, null, 2),
      );
      await verifyFile(verifier, JSON.stringify(bad));
      await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible({
        timeout: 90000,
      });
      report.checks.push({
        id: 'preuve-alteree',
        passed: true,
        observed: 'Preuve invalide : les octets cryptographiques ont été altérés.',
      });
      const jwk = JSON.parse(
        await readFile(join(fixture.directory, 'source/demo-tva.cle-publique.clair'), 'utf8'),
      );
      const source = { ...fixture.config.source, jwk, approved: false };
      const revoke = await admin.request.post(runtime.url + '/api/issuers', {
        headers: { Origin: runtime.url },
        data: source,
      });
      if (!revoke.ok()) throw Error('Révocation de démonstration refusée.');
      try {
        await verifyFile(verifier, proofText);
        await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible({
          timeout: 90000,
        });
        await expect(
          verifier.getByText(/La preuve ZK est valide, mais la provenance signée/),
        ).toBeVisible();
        report.checks.push({
          id: 'source-revoquee',
          passed: true,
          observed:
            'Le calcul ZK reste valide ; la provenance ne satisfait plus le registre approuvé.',
        });
        await verifier.screenshot({
          path: join(fixture.directory, 'erreurs', 'source-revoquee.png'),
          fullPage: true,
          animations: 'disabled',
        });
      } finally {
        const restored = await admin.request.post(runtime.url + '/api/issuers', {
          headers: { Origin: runtime.url },
          data: { ...source, approved: true },
        });
        if (!restored.ok())
          report.checks.push({
            id: 'restauration-source',
            passed: false,
            observed: 'Restauration refusée.',
          });
      }
    } finally {
      await verifierContext.close();
    }
  } finally {
    await context.close();
    await admin.close();
  }
}
export async function zipKit(directory) {
  const files = {};
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else files[relative(directory, p).replaceAll('\\', '/')] = new Uint8Array(await readFile(p));
    }
  }
  await walk(directory);
  await writeFile(directory + '.zip', zipSync(files, { level: 6 }));
}
export async function benchmarkVatDemo(options) {
  const fixture = await prepareVatDemo(options.root, options.counts);
  await writeFile(
    join(fixture.directory, 'README.md'),
    kitReadme(fixture.directory, fixture.config),
    { mode: 0o600 },
  );
  console.log('Kit fictif : ' + relative(process.cwd(), fixture.directory));
  console.log('Démarrage des mesures réelles.');
  let browser, runtime;
  const report = {
    startedAt: new Date().toISOString(),
    status: 'running',
    runs: [],
    checks: [],
    externalDomains: new Set(),
    privateDataTransmitted: false,
    environment: {},
  };
  try {
    runtime = await startVatDemo({ directory: fixture.directory });
    browser = await chromium.launch();
    report.environment = await measurementEnvironment(browser);
    for (const count of options.counts)
      for (let repetition = 1; repetition <= options.repetitions; repetition++) {
        console.log(
          'Mesure ' + count + ' documents — passage ' + repetition + '/' + options.repetitions,
        );
        report.runs.push(await runVolume({ browser, runtime, fixture, count, repetition, report }));
        await writeBenchmarkReport(fixture.directory, {
          ...report,
          externalDomains: [...report.externalDomains],
        });
      }
    console.log('Vérification des erreurs volontaires.');
    await negativeCases({ browser, runtime, fixture, report });
    report.verifierCircuitChecks = await validateDemoProofs({ browser, runtime, fixture });
    if (report.checks.some((check) => !check.passed))
      throw Error('Un contrôle de démonstration a échoué.');
    if (report.privateDataTransmitted)
      throw Error('Le contrôle des requêtes a détecté un marqueur privé.');
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = error.message;
    throw error;
  } finally {
    try {
      report.finishedAt = new Date().toISOString();
      await writeBenchmarkReport(fixture.directory, {
        ...report,
        externalDomains: [...report.externalDomains],
      });
      await writeFile(
        join(fixture.directory, 'erreurs', 'CONSTATS.md'),
        '# Contrôles observés\n\n' +
          report.checks.map((c) => '- ' + c.id + ' : ' + c.observed).join('\n') +
          '\n',
      );
      await copyClientDocuments(fixture.directory);
    } finally {
      await Promise.allSettled([browser?.close(), runtime?.close()]);
    }
    await zipKit(fixture.directory);
  }
  await writeFile(
    join(dirname(fixture.directory), 'latest.json'),
    JSON.stringify({ directory: relative(process.cwd(), fixture.directory) }, null, 2),
  );
  console.log('Démonstration et mesures terminées : ' + relative(process.cwd(), fixture.directory));
  return fixture.directory;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  benchmarkVatDemo(benchmarkOptions(process.argv.slice(2))).catch((error) => {
    console.error('Démonstration interrompue : ' + error.message);
    process.exitCode = 1;
  });
}

export async function validateDemoProofs({ browser, runtime, fixture }) {
  const checks = [];
  for (const count of fixture.config.counts) {
    const target = join(fixture.directory, 'lots', String(count)),
      xmlDir = join(target, 'xml');
    const files = await Promise.all(
      (await readdir(xmlDir)).map(async (name) => ({
        name,
        bytes: new Uint8Array(await readFile(join(xmlDir, name))),
      })),
    );
    const reference = fixtureReference(files);
    const proof = JSON.parse(await readFile(join(target, 'preuve-valide.preuve.clair'), 'utf8'));
    const expectedHash = await circuitHash(vatCircuit(vatCapacity(count)));
    const proved =
      proof.publicData.find((f) => f.id === 'sales_vat').value -
      proof.publicData.find((f) => f.id === 'credit_vat').value;
    if (proof.circuitHash !== expectedHash || proved !== reference.netVatCents)
      throw Error('La preuve diffère du circuit ou du total XML de référence.');
    await writeFile(
      join(target, 'reference.json'),
      JSON.stringify({ ...reference, circuitHash: expectedHash }, null, 2),
    );
    await writeFile(
      join(target, 'REFERENCE.md'),
      '# Référence indépendante du lot fictif\n\nSomme des TaxAmount lus dans les XML originaux, indépendamment du calcul Noir.\n\n- Factures : ' +
        reference.invoices +
        '\n- Avoirs : ' +
        reference.credits +
        '\n- TVA des ventes : ' +
        reference.salesVatCents +
        ' centimes\n- TVA des avoirs : ' +
        reference.creditVatCents +
        ' centimes\n- Solde attendu : ' +
        reference.netVatCents +
        ' centimes\n- Solde prouvé : ' +
        proved +
        ' centimes\n- Empreinte du circuit attendu : ' +
        expectedHash +
        '\n\nLe PDF est une lecture publique du résultat ; le fichier .clair permet la vérification cryptographique.\n',
    );
    const context = await browser.newContext();
    try {
      await waitBudget(context.request, runtime.url);
      const page = await context.newPage();
      await page.goto(runtime.url + '/?view=verify');
      await page
        .getByLabel('Fichier de preuve')
        .setInputFiles(join(target, 'preuve-valide.preuve.clair'));
      await page.getByText('Vérifier une règle précise (avancé)', { exact: true }).click();
      await page.getByPlaceholder('Empreinte SHA-256 fournie par le demandeur').fill(expectedHash);
      await page.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
      await expect(page.getByText('Preuve valide', { exact: true })).toBeVisible({
        timeout: 90000,
      });
      await expect(page.getByText('Calcul et source vérifiés', { exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      const publicText = await page.locator('.verification-report').textContent();
      if (['DEMO-FA-', 'netCents', '<?xml'].some((marker) => publicText.includes(marker)))
        throw Error('Données privées présentes dans le rapport.');
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: join(target, 'rapport-public.pdf'), format: 'A4' });
      checks.push({
        count,
        circuitHash: expectedHash,
        referenceNetCents: reference.netVatCents,
        provedNetCents: proved,
        valid: true,
      });
    } finally {
      await context.close();
    }
  }
  return checks;
}
