import { test, expect } from '@playwright/test';
import { waitForApiBudget } from './helpers/browser-budget.mjs';
import { readyCircuit } from '../src/features/circuits/catalog-model.js';
test.beforeEach(async ({ request }) => waitForApiBudget(request));
test('appearance follows the device, persists only its preference and supports keyboard navigation and FAQ', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu principal' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('combobox', { name: 'Apparence' }).selectOption('light');
  await page.screenshot({ path: 'test-results/ux-light-desktop.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Apparence' }).selectOption('dark');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Apparence' })).toHaveValue('dark');
  await page.screenshot({ path: 'test-results/ux-dark-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Comprendre le zero knowledge/ }).click();
  await expect(page.getByRole('figure')).toBeVisible();
  await page.getByRole('button', { name: 'Consulter la FAQ' }).click();
  const question = page
    .locator('summary')
    .filter({ hasText: 'Une preuve valide peut-elle donner un résultat faux ?' });
  await question.click();
  await expect(page.getByText('Oui. Une preuve valide peut confirmer')).toBeVisible();
  await question.click();
  await expect(page.getByText('Oui. Une preuve valide peut confirmer')).toBeHidden();
  await expect(page.locator('time')).toHaveText('02/11/2026');
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ 'clair.theme': 'dark' });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeHidden();
});
test('mobile navigation contains keyboard focus, closes with Escape and keeps authentication usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Apparence' }).selectOption('dark');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Navigation principale' });
  await expect(menu.getByRole('button', { name: 'Fermer le menu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(menu.getByRole('button', { name: /Mon compte/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('button', { name: 'Fermer le menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeFocused();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await menu.getByRole('button', { name: /Mon compte/ }).click();
  const password = page.getByLabel('Mot de passe', { exact: true });
  await password.fill('private-local-value');
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Masquer le mot de passe' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await expect(password).toHaveValue('');
  await page.screenshot({ path: 'test-results/ux-dark-mobile-auth.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(
    'private-local-value',
  );
});
test('catalog and saved circuits search locally, copy full hashes and confirm deletions before making a request', async ({
  page,
  context,
}) => {
  await page.goto('/inscription');
  await page.getByLabel('Adresse e-mail').fill('ux-search@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.request.post('/__test__/subscription', {
    headers: { Origin: 'http://localhost:3001' },
    data: {},
  });
  const add = await page.request.post('/api/circuits', {
    headers: { Origin: 'http://localhost:3001' },
    data: readyCircuit('age'),
  });
  expect(add.ok()).toBe(true);
  const record = await add.json();
  await page.reload();
  await page.getByRole('button', { name: /^Mes circuits/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const requests = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) requests.push(r.url());
  });
  await page.getByRole('searchbox', { name: 'Rechercher un circuit' }).fill('MAJORITE');
  await expect(
    page.getByRole('button', { name: 'Utiliser Condition de majorité', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Utiliser TVA collectée', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('searchbox').fill('absent');
  await expect(page.getByText('Aucun modèle ne correspond à votre recherche.')).toBeVisible();
  await page.getByRole('button', { name: 'Effacer : Rechercher un circuit' }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page
    .getByRole('button', { name: 'Copier l’empreinte de Condition de majorité', exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(record.hash);
  const remove = page.getByRole('button', { name: 'Supprimer Condition de majorité', exact: true });
  await remove.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(requests.filter((p) => p.includes('/api/circuits/'))).toHaveLength(0);
  await remove.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Supprimer le circuit', exact: true })
    .click();
  await expect(page.getByText('Circuit supprimé de votre espace.')).toBeVisible();
  expect(await (await page.request.get('/api/circuits')).json()).toHaveLength(0);
  expect(requests.some((url) => /query=|search=/.test(url))).toBe(false);
});
