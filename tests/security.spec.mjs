import { waitForApiBudget } from './helpers/browser-budget.mjs';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => waitForApiBudget(request));
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const marker = 'CLAIR_SYNTHETIC_SECURITY_' + randomUUID();
const relative = 'data/security-probe-' + randomUUID() + '.txt';
test.beforeAll(async () => {
  await mkdir('data', { recursive: true });
  await writeFile(relative, marker, { flag: 'wx' });
});
test.afterAll(async () => {
  await rm(relative, { force: true });
});
test('internal files and raw imports cannot be downloaded while frontend documents still work', async ({
  page,
  request,
}) => {
  for (const path of [
    '/' + relative,
    '/' + relative + '?raw',
    '/server/config.mjs',
    '/server/config.mjs?raw',
    '/package-lock.json',
    '/@fs/' + process.cwd().replaceAll('\\', '/') + '/' + relative,
  ]) {
    const r = await request.get(path),
      body = await r.text();
    expect(body).not.toContain(marker);
    expect(body).not.toContain('STRIPE_SECRET_KEY');
    expect(body).not.toContain('"lockfileVersion"');
    if (r.ok()) expect(body.toLowerCase()).toContain('<!doctype html>');
    else expect([403, 404]).toContain(r.status());
  }
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
test('logout from every device is accessible from the subscription page', async ({
  page,
  browser,
}) => {
  const email = 'revoke-browser@example.test',
    password = 'long-password-123';
  const account = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://localhost:3001' },
    data: { email, password },
  });
  expect(account.status()).toBe(201);
  const other = await browser.newContext();
  try {
    expect(
      (
        await other.request.post('http://localhost:3001/api/auth/login', {
          headers: { Origin: 'http://localhost:3001' },
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    await page.goto('/?view=billing');
    await page.getByRole('button', { name: 'Se déconnecter de tous les appareils' }).click();
    await expect(page).toHaveURL('/connexion');
    expect((await other.request.get('http://localhost:3001/api/circuits')).status()).toBe(401);
  } finally {
    await other.close();
  }
});
