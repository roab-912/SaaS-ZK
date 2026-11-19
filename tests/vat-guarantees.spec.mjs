import { test, expect } from '@playwright/test';

test('VAT guarantees explain completeness and stay readable on desktop and mobile', async ({
  page,
}) => {
  await page.goto('/?view=vat');
  const guarantees = page.getByRole('region', { name: 'Ce que la preuve garantit' });
  await expect(guarantees).toBeVisible();
  await expect(guarantees.getByText(/Tout le lot signé/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer mes factures XML' })).toBeVisible();
  await expect(guarantees.getByRole('listitem')).toHaveCount(4);
  await expect(guarantees.locator('details')).toHaveCount(0);
  await expect(page.locator('footer')).toBeVisible();
  await page.screenshot({ path: 'test-results/vat-guarantees-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(guarantees.getByText('Montant recalculé')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/vat-guarantees-mobile.png', fullPage: true });
});
