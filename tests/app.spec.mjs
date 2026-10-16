import { test, expect } from '@playwright/test';
import { ENGINE, PLONK_ENGINE, FFLONK_ENGINE, engineName } from '../shared/engines.mjs';

for (const engine of [ENGINE, PLONK_ENGINE, FFLONK_ENGINE]) {
  test('full browser journey: ' + engine, async ({ page, browser }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const privateMarker = '1991-07-14',
      apiBodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiBodies.push(r.postData() || '');
    });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
    ).toBeVisible();
    expect(
      await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true }),
    ).toMatchSnapshot('dashboard-desktop.png', { maxDiffPixels: 0 });
    await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
    await page.getByLabel('Adresse e-mail').fill(engine + '@example.test');
    await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.getByRole('button', { name: 'Activer 30 jours de test' }).click();
    await expect(
      page.getByRole('button', { name: 'Désactiver l’abonnement de test' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
    await page.getByRole('button', { name: /Condition de majorité/ }).click();
    await expect(page.getByText('Votre règle est prête')).toBeVisible();
    await expect(page.getByLabel('Moteur de preuve')).toHaveValue(ENGINE);
    if (engine !== ENGINE) await page.getByLabel('Moteur de preuve').selectOption(engine);
    await page.screenshot({ path: 'test-results/editor-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Enregistrer et prouver' }).click();
    await page.getByLabel('Date de naissance', { exact: true }).fill(privateMarker);
    await page.getByLabel('Né au plus tard le', { exact: true }).fill('2008-09-21');
    await page.getByRole('button', { name: 'Générer ma preuve' }).click();
    await expect(page.getByText('Preuve prête', { exact: true })).toBeVisible({ timeout: 150000 });
    await expect(page.getByLabel('Date de naissance', { exact: true })).toHaveValue('');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger la preuve' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let body = '';
    for await (const chunk of stream) body += chunk;
    const envelope = JSON.parse(body);
    expect(envelope.engine).toBe(engine);
    expect(envelope.circuit.engine ?? ENGINE).toBe(engine);
    expect(body).not.toContain(privateMarker);
    expect(body).not.toContain('19910714');
    await page.getByRole('button', { name: 'Enregistrer dans mon espace' }).click();
    await expect(page.getByRole('button', { name: 'Enregistrée', exact: true })).toBeVisible();
    expect(apiBodies.join('\n')).not.toContain(privateMarker);
    expect(apiBodies.join('\n')).not.toContain('19910714');
    await page.getByRole('button', { name: 'Ouvrir la vérification' }).click();
    await page.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(page.getByText('Preuve cryptographiquement valide')).toBeVisible({
      timeout: 150000,
    });
    await page.screenshot({ path: 'test-results/verified-desktop.png', fullPage: true });
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto('/');
    await publicPage.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
    await publicPage.getByLabel('Fichier de preuve').setInputFiles({
      name: 'proof.clair.json',
      mimeType: 'application/json',
      buffer: Buffer.from(body),
    });
    await publicPage.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(publicPage.getByText('Preuve cryptographiquement valide')).toBeVisible({
      timeout: 150000,
    });
    envelope.circuit.name = 'Circuit falsifié';
    await publicPage.getByLabel('Fichier de preuve').setInputFiles({
      name: 'tampered.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(envelope)),
    });
    await publicPage.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(publicPage.getByText('Preuve invalide', { exact: true })).toBeVisible();
    await publicContext.close();
    await page.getByRole('button', { name: 'Mes circuits', exact: false }).click();
    await page.getByRole('button', { name: /^Condition de majorité/ }).click();
    await expect(page.getByLabel('Moteur de preuve')).toHaveValue(engine);
    await expect(
      page.getByRole('option', { name: new RegExp(engineName(engine).replaceAll('/', '\\/')) }),
    ).toHaveAttribute('value', engine);
    await page.getByRole('button', { name: 'Mon abonnement' }).click();
    await page.getByRole('button', { name: 'Désactiver l’abonnement de test' }).click();
    await page.getByRole('button', { name: 'Mes preuves', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Condition de majorité' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Mes circuits', exact: false }).click();
    await expect(page.getByRole('button', { name: /^Condition de majorité/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('mobile layout and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true }),
  ).toMatchSnapshot('dashboard-mobile.png', { maxDiffPixels: 0 });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
  await expect(page.getByText('Déposez votre preuve ici')).toBeVisible();
});
