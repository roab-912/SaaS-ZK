import { test, expect } from '@playwright/test';
import { verifySignature } from '../shared/attestations.mjs';
import { unzipSync, strFromU8 } from 'fflate';

test('an admin creates a source, downloads its keys and imports the private file to sign', async ({
  page,
}) => {
  let sources = [];
  const requests = [];
  const errors = [];
  // The server route tests cover real admin authorization; this fixture exposes the admin UI.
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.user) data.user.admin = true;
    await route.fulfill({ response, json: data });
  });
  await page.route(/\/api\/(?:admin\/)?issuers$/, async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      expect(Object.keys(body.jwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
      sources = [...sources.filter((source) => source.id !== body.id), body];
      await route.fulfill({ json: { ok: true }, headers: { 'X-Clair-Protocol': '5' } });
    } else {
      await route.fulfill({
        json: request.url().includes('/admin/')
          ? sources
          : sources.filter((source) => source.approved),
        headers: { 'X-Clair-Protocol': '5' },
      });
    }
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.postData() ?? '');
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('source-keys@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('button', { name: 'Se déconnecter', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sources de confiance', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('Generated Source');
  await page.getByLabel('Nom', { exact: true }).fill('Source générée');
  const keysDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Générer les clés' }).click();
  const downloaded = await keysDownload;
  expect(downloaded.suggestedFilename()).toBe('generated-source.cles.zip');
  const chunks = [];
  for await (const chunk of await downloaded.createReadStream()) chunks.push(chunk);
  const keyFiles = unzipSync(Buffer.concat(chunks));
  const privateKey = JSON.parse(strFromU8(keyFiles['generated-source.cle-privee.clair']));
  const publicKey = JSON.parse(strFromU8(keyFiles['generated-source.cle-publique.clair']));
  expect(privateKey.d).toHaveLength(43);
  expect(publicKey).not.toHaveProperty('d');
  await page.getByRole('button', { name: 'Enregistrer la source' }).click();
  await expect(page.getByText('Source générée', { exact: true })).toBeVisible();
  expect(sources[0].jwk).toEqual(publicKey);

  const row = page.getByRole('row').filter({ hasText: 'generated-source' });
  await row.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom de generated-source', { exact: true }).fill('Autorité renommée');
  await row.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(row.getByText('Autorité renommée')).toBeVisible();
  await row.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Statut de generated-source').selectOption('false');
  await row.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Révoquer la source', exact: true }).click();
  await expect(row.getByText('Révoquée', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Statut de generated-source').selectOption('true');
  await row.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(row.getByText('Approuvée', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Créer une attestation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Circuit à utiliser' }).selectOption('manual');
  await page.getByLabel('Nom du champ signé').fill('income_monthly_eur');
  await page.getByLabel('Valeur à attester', { exact: true }).fill('3000');
  await page.getByLabel('Importer une clé privée pour la donnée').setInputFiles({
    name: 'generated-source.cle-privee.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(privateKey)),
  });
  await page.getByRole('button', { name: 'Signer la donnée', exact: true }).click();
  await expect(page.getByText('Attestation prête', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger l’attestation' }).click();
  let signedText = '';
  for await (const chunk of await (await pending).createReadStream()) signedText += chunk;
  const signed = JSON.parse(signedText);
  expect(signed.value).toBe(3000);
  expect(await verifySignature(signed)).toBe(true);
  expect(signedText).not.toContain(privateKey.d);

  await page.getByRole('button', { name: 'Retour aux sources' }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('imported-source');
  await page.getByLabel('Nom', { exact: true }).fill('Source importée');
  await page.getByText('Clé publique et import d’une clé existante', { exact: true }).click();
  await page.getByLabel('Importer une clé publique existante (.clair ou .json)').setInputFiles({
    name: 'generated-source.cle-publique.clair',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(publicKey)),
  });
  await expect(page.getByLabel('Clé publique P-256 (JWK)')).toHaveValue(
    JSON.stringify(publicKey, null, 2),
  );
  await page.getByRole('button', { name: 'Enregistrer la source' }).click();
  await expect(page.getByText('Source importée', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests.join('\n')).not.toContain(privateKey.d);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(privateKey.d);
  expect(errors).toEqual([]);
});
