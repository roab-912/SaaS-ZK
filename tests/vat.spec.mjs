import { test, expect } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { makeUblExamples } from '../shared/ubl-examples.mjs';

for (const scenario of [
  {
    id: 'fr',
    label: 'standard invoices',
    count: 10,
    company: 'FR00000000000',
    start: '01/09/2026',
    end: '30/09/2026',
  },
  {
    id: 'de',
    label: 'foreign standard, reverse charge and export',
    count: 3,
    company: 'DE123456789',
    start: '01/08/2026',
    end: '31/08/2026',
  },
])
  test('certified UBL invoices: ' + scenario.label, async ({ page, browser }) => {
    test.setTimeout(300000);
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pub = pair.publicKey.export({ format: 'jwk' }),
      priv = pair.privateKey.export({ format: 'jwk' });
    let approved = true;
    const registry = (context) =>
      context.route('**/api/issuers', (route) =>
        route.fulfill({
          json: approved
            ? [{ id: 'vat-demo', name: 'Facturation de démonstration', jwk: pub }]
            : [],
          headers: { 'X-Clair-Protocol': '5' },
        }),
      );
    await registry(page.context());
    const errors = [],
      bodies = [],
      downloads = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/api/')) bodies.push(r.postData() ?? '');
    });
    await page.goto('/inscription');
    await page.getByLabel('Adresse e-mail').fill('vat-' + scenario.id + '@example.test');
    await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
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
    await page.getByLabel('Début de période', { exact: true }).fill(scenario.start);
    await page.getByLabel('Fin de période', { exact: true }).fill(scenario.end);
    const files =
      scenario.id === 'fr'
        ? makeUblExamples({ count: scenario.count })
        : await Promise.all(
            ['vatira-sale.xml', 'vatira-reverse-charge.xml', 'vatira-export.xml'].map(
              async (name) => ({ name, bytes: await readFile('tests/fixtures/ubl/' + name) }),
            ),
          );
    await page.getByLabel('Importer des factures UBL', { exact: true }).setInputFiles(
      files.map((f) => ({
        name: f.name,
        mimeType: 'application/xml',
        buffer: Buffer.from(f.bytes),
      })),
    );
    await expect(
      page.getByText(scenario.count + ' factures et avoirs prêts', { exact: true }),
    ).toBeVisible();

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
    await expect(page.getByLabel('Clé privée de l’émetteur TVA', { exact: true })).toHaveCount(0);
    expect(await (await page.request.get('/api/circuits')).json()).toHaveLength(0);
    let next, batch;
    if (scenario.id === 'de') {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.sidebar')).not.toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
      await page.screenshot({
        path: 'test-results/vat-journey-signed-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('button', { name: 'Continuer vers ma preuve' }).click();
      await expect(page.getByRole('heading', { name: 'Prouver la TVA collectée' })).toBeVisible();
      expect(downloads).toHaveLength(0);
      await page.screenshot({
        path: 'test-results/vat-journey-proof-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
      await page.setViewportSize({ width: 1440, height: 1050 });
    } else {
      next = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Télécharger le lot certifié' }).click();
      const batchDownload = await next;
      expect(batchDownload.suggestedFilename()).toMatch(/\.clair$/);
      let batchText = '';
      for await (const c of await batchDownload.createReadStream()) batchText += c;
      batch = JSON.parse(batchText);
      expect(batch.invoices).toHaveLength(scenario.count);
      await page.getByRole('button', { name: /^Mes circuits/ }).click();
      await page.getByRole('button', { name: 'Utiliser TVA collectée' }).click();
      await page.getByText('J’ai déjà un lot signé', { exact: true }).click();
      const omitted = { ...batch, invoices: batch.invoices.slice(1) };
      await page.getByLabel('Lot de factures certifié', { exact: true }).setInputFiles({
        name: 'incomplet.clair',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(omitted)),
      });
      await expect(page.getByRole('alert')).toContainText('nombre de documents UBL');
      await page.getByLabel('Lot de factures certifié', { exact: true }).setInputFiles({
        name: 'factures.clair',
        mimeType: 'application/json',
        buffer: Buffer.from(batchText),
      });
    }
    const amount = page.getByLabel('TVA collectée en euros', { exact: true });
    await expect(amount).toBeVisible();
    const actual = await amount.inputValue();
    if (scenario.id === 'de') expect(actual).toBe('396,50');
    await amount.fill('0,01');
    await page.getByRole('button', { name: 'Générer la preuve TVA' }).click();
    await expect(page.getByRole('alert')).toContainText('montant annoncé');
    await amount.fill(actual);
    await page.getByRole('button', { name: 'Générer la preuve TVA' }).click();
    await expect(page.getByRole('heading', { name: 'Preuve TVA prête' })).toBeVisible({
      timeout: 240000,
    });
    await expect(amount).toHaveCount(0);
    next = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger la preuve TVA' }).click();
    const proofDownload = await next;
    let proofText = '';
    for await (const c of await proofDownload.createReadStream()) proofText += c;
    const proof = JSON.parse(proofText);
    expect(proof.format).toBe('clair-proof/vat-1');
    expect(proof.vatManifest.count).toBe(scenario.count);
    expect(proofText).not.toContain('netCents');
    expect(proofText).not.toContain('FA-000001');
    if (batch) expect(proofText).not.toContain(batch.blinding);
    expect(proofText).not.toContain('INV-2026-0042');
    expect(bodies.join('\n')).not.toContain('<?xml');
    await page.getByRole('button', { name: 'Enregistrer dans mon espace' }).click();
    await expect(page.getByRole('button', { name: 'Enregistrée', exact: true })).toBeVisible();
    const session = await (await page.request.get('/api/session')).json();
    expect(session.usage.circuits).toBe(1);
    expect(session.usage.proofs).toBe(1);
    expect(session.usage.generations).toBe(1);
    expect(bodies.join('\n')).not.toContain('netCents');
    expect(bodies.join('\n')).not.toContain('FA-000001');
    expect(bodies.join('\n')).not.toContain(priv.d);
    const context = await browser.newContext();
    await registry(context);
    const verifier = await context.newPage();
    await verifier.goto('/');
    await verifier.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
    await verifier.getByLabel('Fichier de preuve').setInputFiles({
      name: 'TVA.preuve.clair',
      mimeType: 'application/json',
      buffer: Buffer.from(proofText),
    });
    await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(verifier.getByText('Preuve valide')).toBeVisible({
      timeout: 60000,
    });
    await expect(verifier.getByText('Calcul et source vérifiés')).toBeVisible();
    await expect(verifier.getByText(scenario.company)).toBeVisible();
    await verifier.setViewportSize({ width: 390, height: 844 });
    expect(await verifier.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await verifier.screenshot({
      path: 'test-results/vat-verified-mobile-' + scenario.id + '.png',
      fullPage: true,
      animations: 'disabled',
    });
    approved = false;
    await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible({
      timeout: 60000,
    });
    await expect(verifier.getByText('Source non approuvée ou révoquée.')).toBeVisible();
    await context.close();
    expect(errors).toEqual([]);
  });
