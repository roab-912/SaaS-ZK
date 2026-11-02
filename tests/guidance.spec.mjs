import { test, expect } from '@playwright/test';
import { waitForApiBudget } from './helpers/browser-budget.mjs';
test.beforeEach(async ({ request, page }) => {
  await waitForApiBudget(request);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test('understanding and FAQ are distinct public pages with an illustrative local example', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Comprendre le zero knowledge/ }).click();
  await expect(page).toHaveURL('/comprendre');
  await expect(
    page.getByRole('heading', { name: 'Comprendre le zero knowledge', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('figure', { name: 'De vos données à la preuve' })).toBeVisible();
  await expect(page.locator('details')).toHaveCount(0);
  const posts = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.getByRole('button', { name: 'Personne de 16 ans' }).click();
  await expect(page.getByRole('status')).toContainText('Résultat de l’exemple : Faux');
  await expect(page.getByRole('region', { name: 'Chez le destinataire' })).not.toContainText(
    '16 ans',
  );
  expect(posts).toEqual([]);
  await page.screenshot({ path: 'test-results/understanding-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Consulter la FAQ' }).click();
  await expect(page).toHaveURL('/faq');
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await expect(page.getByRole('figure')).toHaveCount(0);
  const question = page
    .locator('summary')
    .filter({ hasText: 'Une preuve valide peut-elle donner un résultat faux ?' });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Oui. Une preuve valide peut confirmer')).toBeVisible();
  await page.screenshot({ path: 'test-results/faq-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await page
    .locator('main')
    .getByRole('button', { name: 'Comprendre le zero knowledge', exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole('figure')).toBeVisible();
  await page.getByRole('button', { name: 'FAQ', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL('/comprendre');
  await expect(page.getByRole('figure')).toBeVisible();
});
test('the educational diagram and FAQ fit mobile screens in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/comprendre');
  await page.getByRole('combobox', { name: 'Apparence' }).selectOption('dark');
  await page.getByRole('button', { name: 'Personne de 16 ans' }).click();
  await expect(page.getByRole('status')).toContainText('Faux');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/understanding-mobile-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Consulter la FAQ' }).click();
  await page.getByText('Qu’est-ce qui quitte mon appareil ?', { exact: true }).click();
  await expect(page.getByText(/ne doivent pas contenir de secrets/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/faq-mobile-dark.png', fullPage: true });
});

test('FAQ topic filters, search and reset remain usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/faq');
  await page.getByRole('button', { name: 'Confidentialité', exact: true }).click();
  await expect(page.locator('details')).toHaveCount(2);
  const requests = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) requests.push(r.url());
  });
  await page.getByRole('searchbox', { name: 'Rechercher une réponse' }).fill('APPAREIL');
  await expect(page.locator('details')).toHaveCount(1);
  await page.getByRole('searchbox').fill('aucune correspondance');
  await expect(page.getByText('Aucune réponse pour cette recherche.')).toBeVisible();
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(page.locator('details')).toHaveCount(8);
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.getByRole('button', { name: 'Preuves et vérification', exact: true }).click();
  await expect(page.locator('details')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/faq-mobile-light.png', fullPage: true });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
