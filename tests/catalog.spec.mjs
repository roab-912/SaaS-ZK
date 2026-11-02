import { waitForApiBudget } from './helpers/browser-budget.mjs';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => waitForApiBudget(request));

test('ready income circuit generates a false proof at equality without an editor or private upload', async ({
  page,
}) => {
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('catalog@example.test');
  await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.request.post('/__test__/subscription', {
    headers: { Origin: 'http://localhost:3001' },
    data: {},
  });
  await page.reload();
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  const bodies = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) bodies.push(r.postData() || '');
  });
  await page.getByRole('button', { name: 'Utiliser Revenu supérieur à un seuil' }).click();
  await expect(page.getByRole('heading', { name: 'Générer une preuve' })).toBeVisible();
  await expect(page.getByLabel('Nom du circuit')).toHaveCount(0);
  await expect(page.getByLabel('Revenus mensuels', { exact: true })).toHaveValue('');
  expect(await (await page.request.get('/api/circuits')).json()).toHaveLength(0);
  await page.getByLabel('Revenus mensuels', { exact: true }).fill('87654');
  await page.getByLabel('Seuil mensuel en euros', { exact: true }).fill('87654');
  await page.getByRole('button', { name: 'Générer ma preuve' }).click();
  await expect(page.getByText('Résultat prouvé : Faux', { exact: true })).toBeVisible({
    timeout: 150000,
  });
  expect(bodies.join('\n')).not.toContain('87654');
  expect(await (await page.request.get('/api/circuits')).json()).toHaveLength(1);
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  await page.getByRole('button', { name: 'Utiliser Revenu supérieur à un seuil' }).click();
  await expect(page.getByRole('heading', { name: 'Générer une preuve' })).toBeVisible();
  expect(await (await page.request.get('/api/circuits')).json()).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Circuit personnalisé', exact: true }).click();
  await expect(page.getByLabel('Nom du circuit')).toHaveValue('Nouveau circuit');
});
