import { test, expect } from '@playwright/test';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { makeUblExamples } from '../shared/ubl-examples.mjs';

test('UBL import, official validation, certification and private VAT proof', async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  const count = 500,
    files = makeUblExamples({
      count,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      peppol: true,
    });
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
    pub = pair.publicKey.export({ format: 'jwk' }),
    priv = pair.privateKey.export({ format: 'jwk' });
  let approved = true;
  const registry = (c) =>
    c.route('**/api/issuers', (r) =>
      r.fulfill({
        json: approved
          ? [{ id: 'ubl-demo', name: 'Plateforme UBL de démonstration', jwk: pub }]
          : [],
        headers: { 'X-Clair-Protocol': '5' },
      }),
    );
  await registry(page.context());
  const bodies = [],
    errors = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) bodies.push(r.postData() ?? '');
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('ubl@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.request.post('/__test__/subscription', {
    headers: { Origin: 'http://localhost:3001' },
    data: {},
  });
  await page.reload();
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  await page.getByRole('button', { name: 'Utiliser TVA collectée' }).click();
  await page.getByRole('button', { name: 'Importer mes factures XML' }).click();
  await page.getByLabel('Début de période', { exact: true }).fill('01/09/2026');
  await page.getByLabel('Fin de période', { exact: true }).fill('30/09/2026');
  await page.getByLabel('Importer des factures UBL', { exact: true }).setInputFiles(
    files.map((f) => ({
      name: f.name,
      mimeType: 'application/xml',
      buffer: Buffer.from(f.bytes),
    })),
  );
  await expect(page.getByText(count + ' factures et avoirs prêts', { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await expect(page.getByText('FR00000000000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuer vers la signature' }).click();
  await page.getByRole('checkbox').check();
  await page.getByLabel('Importer la clé privée TVA').setInputFiles({
    name: 'private.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(priv)),
  });
  await page.getByRole('button', { name: 'Signer le relevé complet' }).click();
  await expect(page.getByRole('heading', { name: 'Lot certifié prêt' })).toBeVisible({
    timeout: 30000,
  });
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le lot certifié' }).click();
  let batchText = '';
  for await (const b of await (await download).createReadStream()) batchText += b;
  const batch = JSON.parse(batchText);
  expect(batch.format).toBe('clair-vat-batch/2');
  expect(batch.manifest.format).toBe('clair-vat-manifest/2');
  expect(batch.documents).toHaveLength(count);
  expect(batch.documents[0].sha256).toBe(createHash('sha256').update(files[0].bytes).digest('hex'));
  expect(Buffer.from(batch.documents[0].content, 'base64')).toEqual(Buffer.from(files[0].bytes));
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  await page.getByRole('button', { name: 'Utiliser TVA collectée' }).click();
  await page.getByText('J’ai déjà un lot signé', { exact: true }).click();
  const bad = structuredClone(batch);
  bad.documents[0].content = Buffer.from('<Invoice/>').toString('base64');
  await page.getByLabel('Lot de factures certifié', { exact: true }).setInputFiles({
    name: 'falsifie.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText('document UBL original');
  await page.getByLabel('Lot de factures certifié', { exact: true }).setInputFiles({
    name: 'factures.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(batchText),
  });
  await expect(page.getByLabel('TVA collectée en euros')).toBeVisible();
  await page.getByRole('button', { name: 'Générer la preuve TVA' }).click();
  await expect(page.locator('.proof-progress-steps li[aria-current="step"]')).toHaveText(
    'Création de la preuve',
    { timeout: 120000 },
  );
  const clock = page.getByLabel('Temps écoulé');
  const initialTime = await clock.textContent();
  await expect.poll(() => clock.textContent()).not.toBe(initialTime);
  await expect(
    page.getByRole('progressbar', { name: 'Étapes de génération terminées' }),
  ).toHaveAttribute('value', '3');
  await expect(page.getByRole('heading', { name: 'Preuve TVA prête' })).toBeVisible({
    timeout: 240000,
  });
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger la preuve TVA' }).click();
  let proofText = '';
  for await (const b of await (await download).createReadStream()) proofText += b;
  const proof = JSON.parse(proofText);
  expect(proof.vatManifest.documentsRoot).toBe(batch.manifest.documentsRoot);
  expect(proofText).not.toContain('content');
  expect(proofText).not.toContain(batch.documents[0].content);
  expect(proofText).not.toContain('DEMO-FA');
  expect(bodies.join('\n')).not.toContain('<?xml');
  expect(bodies.join('\n')).not.toContain('netCents');
  expect(bodies.join('\n')).not.toContain(priv.d);
  const context = await browser.newContext();
  await registry(context);
  const verifier = await context.newPage();
  await verifier.goto('/');
  await verifier.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
  await verifier.getByLabel('Fichier de preuve').setInputFiles({
    name: 'preuve.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(proofText),
  });
  await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
  await expect(verifier.getByText('Preuve valide')).toBeVisible({
    timeout: 60000,
  });
  approved = false;
  await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
  await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await context.close();
  expect(errors).toEqual([]);
});

test('UBL errors are explicit and the authority form fits a mobile screen', async ({ page }) => {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  await page.route('**/api/issuers', (r) =>
    r.fulfill({
      json: [
        {
          id: 'ubl-demo',
          name: 'Plateforme UBL de démonstration',
          jwk: publicKey.export({ format: 'jwk' }),
        },
      ],
      headers: { 'X-Clair-Protocol': '5' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Sources de confiance', exact: true }).click();
  await page.getByRole('button', { name: 'Certifier des factures', exact: true }).click();
  await page.getByLabel('Début de période', { exact: true }).fill('01/09/2026');
  await page.getByLabel('Fin de période', { exact: true }).fill('30/09/2026');

  await page.getByText('Essayer avec des exemples', { exact: true }).click();
  await page.getByLabel('Nombre de pièces de démonstration').fill('2');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger des exemples UBL', exact: true }).click();
  const chunks = [];
  for await (const chunk of await (await downloading).createReadStream()) chunks.push(chunk);
  const files = Object.entries(unzipSync(Buffer.concat(chunks))).map(([name, bytes]) => ({
    name,
    bytes,
  }));
  expect(files[0].name).toBe('001-DEMO-FA-000001.xml');

  const invalid = new TextDecoder()
    .decode(files[0].bytes)
    .replace(/(<cbc:PayableAmount[^>]*>)[^<]+/, (_, p) => p + '0.01');
  const input = page.getByLabel('Importer des factures UBL', { exact: true });
  await input.setInputFiles({
    name: 'montant-incorrect.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(invalid),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText(/montant-incorrect.xml.*BR-/);
  await input.setInputFiles(
    files.map((f) => ({ name: f.name, mimeType: 'application/xml', buffer: Buffer.from(f.bytes) })),
  );
  await expect(page.getByText('2 factures et avoirs prêts', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  await expect(
    page.getByRole('heading', { name: 'Certifier un relevé de factures' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: 'test-results/ubl-authority-mobile.png',
    animations: 'disabled',
    fullPage: true,
  });
});
