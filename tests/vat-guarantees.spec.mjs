import { test, expect } from '@playwright/test';

test('VAT guarantees explain completeness and stay readable on desktop and mobile', async ({
  page,
}) => {
  await page.goto('/?view=vat');
  const guarantees = page.getByRole('region', { name: 'Ce que la preuve garantit' });
  await expect(guarantees).toBeVisible();
  await expect(guarantees.getByText(/Tout le lot signé/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer mes factures XML' })).toBeVisible();
  await guarantees.getByText('Comment l’exhaustivité est-elle garantie ?').click();
  await expect(guarantees.getByText(/pour 100 pièces certifiées/)).toBeVisible();
  await page.screenshot({ path: 'test-results/vat-guarantees-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await guarantees.getByText('Quels contrôles sont imposés par le circuit ?').click();
  await expect(guarantees.getByText(/Identifiants distincts/)).toBeVisible();
  await guarantees.getByText('Quelles règles de TVA sont appliquées ?').click();
  await expect(guarantees.getByText('Le rattachement utilise la date de facture.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/vat-guarantees-mobile.png', fullPage: true });
});
