import { waitForApiBudget } from './helpers/browser-budget.mjs';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => waitForApiBudget(request));
test('billing documents stay in Clair and return to an isolated ZK workspace', async ({ page }) => {
  const registration = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://localhost:3001' },
    data: { email: 'billing-navigation@example.test', password: 'long-password-123' },
  });
  expect(registration.status()).toBe(201);
  await page.goto('/abonnement/paiement?offre=essential');
  await expect(page.getByRole('heading', { name: 'Souscrire à Clair' })).toBeVisible();
  await expect(page.locator('main').getByRole('alert')).toHaveText(/pas.*configuré/);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  expect(new URL(page.url()).origin).toBe('http://localhost:3001');
  await page.getByRole('button', { name: 'Retour à mon abonnement' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(await page.locator('script[src*="stripe.com"]').count()).toBe(0);
});
test('mobile billing page requires authentication and opens the Clair login page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/abonnement/gestion');
  await expect(page.getByRole('heading', { name: 'Gérer mon abonnement' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
  await expect(page.getByText('Heureux de vous retrouver.')).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
