import { waitForApiBudget } from './helpers/browser-budget.mjs';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => waitForApiBudget(request));
import { template } from '../shared/circuit.mjs';

test('dedicated auth pages, Essential trial quotas and logout work together', async ({ page }) => {
  await page.goto('/inscription');
  await expect(page.getByText('Votre espace de confiance.')).toBeVisible();
  await page.getByLabel('Adresse e-mail').fill('saas-quota@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.request.post('/__test__/subscription', {
    headers: { Origin: 'http://localhost:3001' },
    data: {},
  });
  await page.reload();
  await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clair Pro', exact: true })).toBeVisible();
  await expect(page.getByLabel('Circuits enregistrés', { exact: true })).toHaveAttribute(
    'max',
    '10',
  );
  for (let i = 0; i < 10; i++) {
    const response = await page.request.post('/api/circuits', {
      headers: { Origin: 'http://localhost:3001' },
      data: { ...template(), name: 'Circuit quota ' + i },
    });
    expect(response.status()).toBe(201);
  }
  const refused = await page.request.post('/api/circuits', {
    headers: { Origin: 'http://localhost:3001' },
    data: { ...template(), name: 'Circuit en trop' },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error).toContain('Limite de circuits');
  await page.reload();
  await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
  await expect(page.getByText('10 / 10', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Configurer Stripe pour souscrire', exact: true }).last(),
  ).toBeDisabled();
  await expect(page.getByText('Tarif à configurer').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/saas-billing.png', fullPage: true });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
  await page.getByLabel('Adresse e-mail').fill('saas-quota@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('long-password-123');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByLabel('Consommation de votre abonnement')).toContainText(
    'Clair Essentiel',
  );
  await expect(page.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/admin/dashboard')).status()).toBe(403);
});

test('signup page fits a mobile screen and supports switching to login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/inscription');
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/saas-signup-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
  await expect(page.getByText('Heureux de vous retrouver.')).toBeVisible();
});
