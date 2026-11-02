import { test, expect } from '@playwright/test';
import { waitForApiBudget } from './helpers/browser-budget.mjs';
test.beforeEach(async ({ request }) => waitForApiBudget(request));
test('personal space is reachable from both entry points, reloadable and useful without an account', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir mon espace personnel' }).click();
  await expect(page).toHaveURL('/espace-personnel');
  await expect(
    page.getByRole('heading', { name: 'Votre espace personnel', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Votre espace personnel', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vérifier une preuve sans compte' }).click();
  await expect(page.getByText('Déposez votre preuve ici')).toBeVisible();
  await page.getByRole('link', { name: 'Espace personnel', exact: true }).click();
  await page.locator('main').getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
});
test('account details, subscription rights, shortcuts and mobile layout use the current session', async ({
  page,
}) => {
  const registration = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://localhost:3001' },
    data: { email: 'personal-space@example.test', password: 'long-password-123' },
  });
  expect(registration.status()).toBe(201);
  await page.goto('/espace-personnel');
  await expect(page.getByText('personal-space@example.test', { exact: true })).toBeVisible();
  await expect(page.getByText('Sans abonnement actif', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choisir un abonnement' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Votre espace personnel', exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.post('/__test__/subscription', {
        headers: { Origin: 'http://localhost:3001' },
        data: {},
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(page.getByText('Actif', { exact: true })).toBeVisible();
  await expect(page.getByText('Clair Essentiel', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Circuits enregistrés' })).toHaveAttribute(
    'max',
    '10',
  );
  await page.screenshot({ path: 'test-results/personal-space-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Ouvrir mes preuves' }).click();
  await expect(page.getByRole('heading', { name: 'Mes preuves', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: 'Apparence' }).selectOption('dark');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Ouvrir mon espace personnel' }).click();
  await expect(
    page.getByRole('heading', { name: 'Votre espace personnel', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/personal-space-mobile-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
  await page.goto('/espace-personnel');
  await expect(page.getByText('personal-space@example.test', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vérifier une preuve sans compte' })).toBeVisible();
});
