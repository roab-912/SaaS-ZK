import { test, expect } from '@playwright/test';
import { ENGINE, PLONK_ENGINE, FFLONK_ENGINE, engineName } from '../shared/engines.mjs';

// Keep production rate limits enabled. Reserve room for a complete browser journey
// and respect the server's reset time between journeys when necessary.
test.beforeEach(async ({ request }) => {
  const response = await request.get('/api/session');
  expect(response.ok()).toBe(true);
  const budget = response.headers()['ratelimit'] ?? '';
  const remaining = Number(/r=(\d+)/.exec(budget)?.[1]);
  const reset = Number(/t=(\d+)/.exec(budget)?.[1]);
  expect(Number.isFinite(remaining)).toBe(true);
  expect(Number.isFinite(reset)).toBe(true);
  if (remaining < 60) await new Promise((resolve) => setTimeout(resolve, (reset + 1) * 1000));
});

for (const engine of [ENGINE, PLONK_ENGINE, FFLONK_ENGINE]) {
  test('full browser journey: ' + engine, async ({ page, browser }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const privateMarker = '1991-07-14',
      apiBodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiBodies.push(r.postData() || '');
    });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
    ).toBeVisible();
    expect(
      await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true }),
    ).toMatchSnapshot('dashboard-desktop.png', { maxDiffPixels: 0 });
    await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
    await page.getByLabel('Adresse e-mail').fill(engine + '@example.test');
    await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
    await page.request.post('/__test__/subscription', {
      headers: { Origin: 'http://localhost:3001' },
      data: {},
    });
    await page.reload();
    await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Configurer Stripe pour souscrire' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
    await page.getByRole('button', { name: /Condition de majorité/ }).click();
    await expect(page.getByText('Votre règle est prête')).toBeVisible();
    await expect(page.getByLabel('Moteur de preuve')).toHaveValue(ENGINE);
    if (engine !== ENGINE) await page.getByLabel('Moteur de preuve').selectOption(engine);
    await page.screenshot({ path: 'test-results/editor-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Enregistrer et prouver' }).click();
    await page.getByLabel('Date de naissance', { exact: true }).fill(privateMarker);
    await page.getByLabel('Né au plus tard le', { exact: true }).fill('2008-09-21');
    await page.getByRole('button', { name: 'Générer ma preuve' }).click();
    await expect(page.getByText('Preuve prête', { exact: true })).toBeVisible({ timeout: 150000 });
    await expect(page.getByLabel('Date de naissance', { exact: true })).toHaveValue('');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger la preuve' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.preuve\.clair$/);
    const stream = await download.createReadStream();
    let body = '';
    for await (const chunk of stream) body += chunk;
    const envelope = JSON.parse(body);
    expect(envelope.engine).toBe(engine);
    expect(envelope.format).toBe('clair-proof/2');
    expect(envelope.result).toBe(true);
    expect(envelope.publicData).toEqual([
      { id: 'cutoff', label: 'Né au plus tard le', type: 'date', value: '2008-09-21' },
    ]);
    expect(envelope.circuit.engine ?? ENGINE).toBe(engine);
    expect(body).not.toContain(privateMarker);
    expect(body).not.toContain('19910714');
    await page.getByRole('button', { name: 'Enregistrer dans mon espace' }).click();
    await expect(page.getByRole('button', { name: 'Enregistrée', exact: true })).toBeVisible();
    expect(apiBodies.join('\n')).not.toContain(privateMarker);
    expect(apiBodies.join('\n')).not.toContain('19910714');
    await page.getByRole('button', { name: 'Ouvrir la vérification' }).click();
    await page.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(page.getByText('Preuve cryptographiquement valide')).toBeVisible({
      timeout: 150000,
    });
    await page.screenshot({ path: 'test-results/verified-desktop.png', fullPage: true });
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto('/');
    await publicPage.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
    await publicPage.getByLabel('Fichier de preuve').setInputFiles({
      name: 'proof.clair',
      mimeType: 'application/json',
      buffer: Buffer.from(body),
    });
    await publicPage.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(publicPage.getByText('Preuve cryptographiquement valide')).toBeVisible({
      timeout: 150000,
    });
    envelope.circuit.name = 'Circuit falsifié';
    await publicPage.getByLabel('Fichier de preuve').setInputFiles({
      name: 'tampered.clair',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(envelope)),
    });
    await publicPage.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(publicPage.getByText('Preuve invalide', { exact: true })).toBeVisible();
    await publicContext.close();
    await page.getByRole('button', { name: 'Mes circuits', exact: false }).click();
    await page.getByRole('button', { name: /^Condition de majorité/ }).click();
    await expect(page.getByLabel('Moteur de preuve')).toHaveValue(engine);
    await expect(
      page.getByRole('option', { name: new RegExp(engineName(engine).replaceAll('/', '\\/')) }),
    ).toHaveAttribute('value', engine);
    await page.getByRole('button', { name: 'Mon abonnement' }).click();
    await page.request.post('/__test__/subscription', {
      headers: { Origin: 'http://localhost:3001' },
      data: { active: false },
    });
    await page.reload();
    await page.getByRole('button', { name: 'Mes preuves', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Condition de majorité' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Mes circuits', exact: false }).click();
    await expect(page.getByRole('button', { name: /^Condition de majorité/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('mobile layout and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true }),
  ).toMatchSnapshot('dashboard-mobile.png', { maxDiffPixels: 0 });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
  await expect(page.getByText('Déposez votre preuve ici')).toBeVisible();
});

for (const engine of [ENGINE, PLONK_ENGINE, FFLONK_ENGINE]) {
  test('private integer comparison can prove false: ' + engine, async ({ page, browser }) => {
    const errors = [],
      bodies = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/api/')) bodies.push(r.postData() || '');
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
    await page.getByLabel('Adresse e-mail').fill('false-' + engine + '@example.test');
    await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
    await page.request.post('/__test__/subscription', {
      headers: { Origin: 'http://localhost:3001' },
      data: {},
    });
    await page.reload();
    await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Configurer Stripe pour souscrire' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
    await page.getByRole('button', { name: /Condition de majorité/ }).click();
    await page.getByLabel('Nom du circuit').fill('Comparaison privée');
    await page.getByLabel('Moteur de preuve').selectOption(engine);
    await expect(page.getByLabel('Résultat à prouver')).toHaveValue('2');
    await page.getByLabel('Bloc niveau 0').selectOption('gte');
    await page.getByRole('combobox', { name: /^Type/ }).nth(0).selectOption('number');
    await page.getByRole('combobox', { name: /^Type/ }).nth(1).selectOption('number');
    await page
      .getByRole('combobox', { name: /^Visibilité/ })
      .nth(1)
      .selectOption('private');
    await page.getByLabel('Libellé', { exact: true }).nth(0).fill('Première valeur');
    await page.getByLabel('Libellé', { exact: true }).nth(1).fill('Deuxième valeur');
    await expect(page.getByText('Votre règle est prête')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer et prouver' }).click();
    await page.getByRole('button', { name: 'Générer ma preuve' }).click();
    await expect(page.getByRole('alert')).toContainText('valeur requise');
    await page.getByLabel('Première valeur', { exact: true }).fill('172946');
    await page.getByLabel('Deuxième valeur', { exact: true }).fill('981273');
    await page.getByRole('button', { name: 'Générer ma preuve' }).click();
    await expect(page.getByText('Preuve prête', { exact: true })).toBeVisible({ timeout: 150000 });
    await expect(page.getByText('Résultat prouvé : Faux', { exact: true })).toBeVisible();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger la preuve' }).click();
    const stream = await (await pending).createReadStream();
    let body = '';
    for await (const chunk of stream) body += chunk;
    const envelope = JSON.parse(body);
    expect(envelope.result).toBe(false);
    expect(envelope.publicData).toEqual([]);
    expect(envelope.publicInputs).toHaveLength(2);
    for (const value of ['172946', '981273']) expect(body).not.toContain(value);
    await page.getByRole('button', { name: 'Enregistrer dans mon espace' }).click();
    await expect(page.getByRole('button', { name: 'Enregistrée', exact: true })).toBeVisible();
    for (const value of ['172946', '981273']) expect(bodies.join('\n')).not.toContain(value);
    const context = await browser.newContext(),
      verifier = await context.newPage();
    await verifier.goto('/');
    await verifier.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
    await verifier.getByLabel('Fichier de preuve').setInputFiles({
      name: 'false.clair',
      mimeType: 'application/json',
      buffer: Buffer.from(body),
    });
    await expect(verifier.getByText('Résultat annoncé — à vérifier')).toBeVisible();
    await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
    await expect(verifier.getByText('Preuve cryptographiquement valide')).toBeVisible({
      timeout: 150000,
    });
    await expect(
      verifier.getByText('La preuve confirme que la règle donne faux.', { exact: false }),
    ).toBeVisible();
    envelope.result = true;
    await verifier.getByLabel('Fichier de preuve').setInputFiles({
      name: 'tampered.clair',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(envelope)),
    });
    await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible();
    await expect(
      verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }),
    ).toBeDisabled();
    await context.close();
    expect(errors).toEqual([]);
  });
}

for (const privateInput of [false, true]) {
  test(
    'custom source: ' +
      (privateInput ? 'private' : 'public') +
      ' signed input, anonymous verification and revocation',
    async ({ page, browser }) => {
      const { generateKeyPairSync } = await import('node:crypto');
      const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
        publicJwk = pair.publicKey.export({ format: 'jwk' }),
        privateJwk = pair.privateKey.export({ format: 'jwk' });
      let approved = [];
      const requests = [];
      await page.context().route('**/api/session', async (route) => {
        const response = await route.fetch(),
          data = await response.json();
        if (data.user) data.user.admin = true; // Admin UI fixture; real authorization is covered by route integration tests.
        await route.fulfill({ response, json: data });
      });
      const registry = async (context) =>
        context.route('**/api/issuers', async (route) => {
          if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON();
            expect(body.jwk.d).toBeUndefined();
            approved = body.approved ? [{ id: body.id, name: body.name, jwk: body.jwk }] : [];
            await route.fulfill({ json: { ok: true }, headers: { 'X-Clair-Protocol': '5' } });
          } else await route.fulfill({ json: approved, headers: { 'X-Clair-Protocol': '5' } });
        });
      await registry(page.context());
      page.on('request', (r) => {
        if (r.url().includes('/api/')) requests.push(r.postData() ?? '');
      });
      await page.goto('/');
      await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
      await page.getByLabel('Adresse e-mail').fill('sources-' + privateInput + '@example.test');
      await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
      await page.request.post('/__test__/subscription', {
        headers: { Origin: 'http://localhost:3001' },
        data: {},
      });
      await page.reload();
      await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Configurer Stripe pour souscrire' }).first(),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Sources de confiance', exact: true }).click();
      await expect(page.getByText('Aucune source disponible')).toBeVisible();
      await expect(page.getByRole('article', { name: 'FranceConnect — à venir' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await page.getByLabel('Identifiant', { exact: true }).fill('source-1');
      await page.getByLabel('Nom', { exact: true }).fill('Banque de test — simulation');
      await page.getByLabel('Clé publique P-256 (JWK)').fill(JSON.stringify(publicJwk));
      await page.getByRole('button', { name: 'Enregistrer la source' }).click();
      await expect(page.getByText('Banque de test — simulation', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
      await page.getByRole('button', { name: /Capacité financière Prouvez/ }).click();
      await expect(
        page
          .getByRole('option', {
            name: 'Banque de test — simulation — signée, valeur publique ou privée',
          })
          .first(),
      ).toBeAttached();
      await page
        .getByLabel('Source de Revenus mensuels', { exact: true })
        .selectOption('issuer:source-1');
      await page
        .getByLabel('Champ signé pour Revenus mensuels', { exact: true })
        .fill('income_monthly_eur');
      await page
        .getByRole('combobox', { name: /^Visibilité/ })
        .nth(1)
        .selectOption('private');
      if (privateInput) {
        await page
          .getByRole('combobox', { name: /^Visibilité/ })
          .first()
          .selectOption('private');
        await expect(page.getByRole('option', { name: 'Circom / PLONK' })).toHaveAttribute(
          'disabled',
          '',
        );
      }
      const circuitDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exporter le circuit public' }).click();
      expect((await circuitDownload).suggestedFilename()).toMatch(/\.circuit\.clair$/);
      let circuitBody = '';
      for await (const chunk of await (await circuitDownload).createReadStream())
        circuitBody += chunk;
      const exportedCircuit = JSON.parse(circuitBody);
      expect(exportedCircuit.inputs.find((i) => i.id === 'income').attestation.claim).toBe(
        'income_monthly_eur',
      );
      expect(exportedCircuit.inputs.every((i) => i.value === undefined)).toBe(true);
      await page.getByRole('button', { name: 'Enregistrer et prouver' }).click();
      const issuerContext = await browser.newContext();
      await registry(issuerContext);
      const issuerPage = await issuerContext.newPage(),
        issuerRequests = [];
      issuerPage.on('request', (r) => {
        if (r.url().includes('/api/')) {
          issuerRequests.push(r.url());
          requests.push(r.postData() ?? '');
        }
      });
      await issuerPage.goto('/');
      await issuerPage.getByRole('button', { name: 'Sources de confiance', exact: true }).click();
      await issuerPage.getByRole('button', { name: 'Créer une attestation', exact: true }).click();
      await expect(
        issuerPage.getByRole('heading', { name: 'Créer une attestation', exact: true }),
      ).toBeVisible();
      await expect(issuerPage.getByLabel('Source émettrice')).toBeVisible();
      await issuerPage.getByLabel('Importer un circuit public').setInputFiles({
        name: 'circuit.clair',
        mimeType: 'application/json',
        buffer: Buffer.from(circuitBody),
      });
      await issuerPage.getByLabel('Valeur pour Revenus mensuels (income)').fill('3000');
      await expect(issuerPage.getByLabel('Nom du champ signé')).toHaveCount(0);
      await issuerPage
        .getByLabel('Clé privée pour les données du circuit', { exact: true })
        .fill(JSON.stringify(privateJwk));
      await issuerPage
        .getByRole('button', { name: 'Signer les données du circuit', exact: true })
        .click();
      await expect(issuerPage.getByText('Attestation prête', { exact: true })).toBeVisible();
      await expect(
        issuerPage.getByLabel('Clé privée pour les données du circuit', { exact: true }),
      ).toHaveValue('');
      const issuingDownload = issuerPage.waitForEvent('download');
      await issuerPage.getByRole('button', { name: 'Télécharger l’attestation' }).click();
      expect((await issuingDownload).suggestedFilename()).toMatch(/\.attestation\.clair$/);
      let attestationBody = '';
      for await (const chunk of await (await issuingDownload).createReadStream())
        attestationBody += chunk;
      const issued = JSON.parse(attestationBody);
      expect(issued.format).toBe(privateInput ? 'clair-attestation/2' : 'clair-attestation/1');
      expect(issued.proof).toBeUndefined();
      expect(issued.value).toBe(3000);
      expect(attestationBody).not.toContain(privateJwk.d);
      expect(issuerRequests.some((url) => /\/api\/(compile|prover|proofs)/.test(url))).toBe(false);
      await issuerPage.screenshot({ path: 'test-results/issued-attestation.png', fullPage: true });
      await issuerContext.close();

      await expect(
        page.getByLabel('Importer l’attestation pour Revenus mensuels', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel('Clé privée pour Revenus mensuels', { exact: true }),
      ).not.toBeVisible();
      await page
        .getByLabel('Importer l’attestation pour Revenus mensuels', { exact: true })
        .setInputFiles({
          name: 'income.attestation.clair',
          mimeType: 'application/json',
          buffer: Buffer.from(attestationBody),
        });
      await expect(page.getByLabel('Revenus mensuels', { exact: true })).toHaveValue('3000');
      await expect(page.getByText('Attestation chargée · source-1', { exact: true })).toBeVisible();
      await page.getByLabel('Loyer mensuel', { exact: true }).fill('777');
      await page.getByRole('button', { name: 'Générer ma preuve' }).click();
      await expect(page.getByText('Preuve prête', { exact: true })).toBeVisible({
        timeout: 150000,
      });
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Télécharger la preuve' }).click();
      expect((await pending).suggestedFilename()).toMatch(/\.preuve\.clair$/);
      let body = '';
      for await (const chunk of await (await pending).createReadStream()) body += chunk;
      const envelope = JSON.parse(body);
      expect(envelope.format).toBe(privateInput ? 'clair-proof/4' : 'clair-proof/3');
      expect(envelope.attestations).toHaveLength(privateInput ? 0 : 1);
      expect(envelope.publicData).toEqual(
        privateInput
          ? []
          : [{ id: 'income', label: 'Revenus mensuels', type: 'number', value: 3000 }],
      );
      if (privateInput) {
        expect(body).not.toContain(issued.signature);
        expect(body).not.toContain(issued.id);
        expect(body).not.toContain('"value": 3000');
        expect(await page.getByLabel('Revenus mensuels', { exact: true }).inputValue()).toBe('');
      }
      await page.getByRole('button', { name: 'Enregistrer dans mon espace' }).click();
      await expect(page.getByRole('button', { name: 'Enregistrée', exact: true })).toBeVisible();
      expect(requests.join('\n')).not.toContain('"rent":"777"');
      expect(requests.join('\n')).not.toContain('"rent":777');
      expect(requests.join('\n')).not.toContain('"privateKey"');
      expect(requests.join('\n')).not.toContain(privateJwk.d);
      expect(body).not.toContain(privateJwk.d);
      if (privateInput) {
        expect(requests.join('\n')).not.toContain(issued.signature);
        expect(requests.join('\n')).not.toContain('"income":"3000"');
        expect(requests.join('\n')).not.toContain('"income":3000');
      }
      const context = await browser.newContext();
      await registry(context);
      const verifier = await context.newPage();
      await verifier.goto('/');
      await verifier.getByRole('button', { name: 'Vérifier une preuve', exact: true }).click();
      await verifier.getByLabel('Fichier de preuve').setInputFiles({
        name: 'proof.clair',
        mimeType: 'application/json',
        buffer: Buffer.from(body),
      });
      await expect(verifier.getByText('Provenance annoncée — à vérifier')).toBeVisible();
      await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
      await expect(verifier.getByText('Origine vérifiée · Source approuvée')).toBeVisible({
        timeout: 150000,
      });
      await expect(
        verifier.getByText('Revenus mensuels · Banque de test — simulation'),
      ).toBeVisible();
      await verifier.screenshot({ path: 'test-results/signed-proof-verified.png', fullPage: true });
      const old = approved;
      approved = [];
      await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
      await expect(verifier.getByText('Preuve invalide', { exact: true })).toBeVisible({
        timeout: 150000,
      });
      await expect(
        verifier.getByText('Source non approuvée, révoquée ou clé remplacée.'),
      ).toBeVisible();
      await expect(verifier.getByText('Origine vérifiée · Source approuvée')).toHaveCount(0);
      approved = old;
      if (privateInput) {
        const expires = new Date(
          Date.parse(envelope.privateAttestations[0].expiresAt) + 1000,
        ).toISOString();
        envelope.privateAttestations[0].expiresAt = expires;
        envelope.publicInputs[3] = '0x' + Date.parse(expires).toString(16);
      } else envelope.attestations[0].attestation.signature = 'A'.repeat(86);
      await verifier.getByLabel('Fichier de preuve').setInputFiles({
        name: 'tampered.clair',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(envelope)),
      });
      await verifier.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
      await expect(
        verifier.getByText(privateInput ? 'Preuve de signature invalide.' : 'Signature invalide.', {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 150000,
      });
      await context.close();
    },
  );
}

test('new circuit and removal of birth both allow a single integer equals 18', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
  await page.getByLabel('Adresse e-mail').fill('integer-equals@example.test');
  await page.getByLabel('Mot de passe', { exact: false }).fill('long-password-123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await page.request.post('/__test__/subscription', {
    headers: { Origin: 'http://localhost:3001' },
    data: {},
  });
  await page.reload();
  await page.getByRole('button', { name: 'Mon abonnement', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Configurer Stripe pour souscrire' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
  await page.getByRole('button', { name: 'Créer un circuit', exact: true }).click();
  await expect(page.getByLabel('Nom du circuit')).toHaveValue('Nouveau circuit');
  await expect(page.getByLabel('Libellé', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Bloc niveau 0')).toHaveValue('eq');
  await expect(page.getByLabel('Valeur fixe', { exact: true })).toHaveValue('18');
  await expect(page.getByText('Votre règle est prête')).toBeVisible();
  await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
  await page.getByRole('button', { name: /Condition de majorité/ }).click();
  await page.getByRole('button', { name: 'Supprimer l’entrée Date de naissance' }).click();
  await expect(page.getByLabel('Entrée utilisée').nth(0)).toHaveValue('cutoff');
  await expect(page.getByLabel('Entrée utilisée').nth(1)).toHaveValue('cutoff');
  await page.getByRole('combobox', { name: /^Type/ }).selectOption('number');
  await page.getByLabel('Bloc niveau 0').selectOption('eq');
  await page.getByLabel('Bloc niveau 1').nth(1).selectOption('constant');
  await page.getByLabel('Libellé', { exact: true }).fill('Valeur');
  await page.getByRole('combobox', { name: /^Visibilité/ }).selectOption('private');
  await page.getByLabel('Nom du circuit').fill('Entier égal à 18');
  await expect(page.getByText('Votre règle est prête')).toBeVisible();
  await expect(page.getByText('Entrée inconnue : birth')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enregistrer et prouver' }).click();
  await page.getByLabel('Valeur', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Générer ma preuve' }).click();
  await expect(page.getByText('Résultat prouvé : Vrai', { exact: true })).toBeVisible({
    timeout: 150000,
  });
  await page.getByLabel('Valeur', { exact: true }).fill('19');
  await page.getByRole('button', { name: 'Générer ma preuve' }).click();
  await expect(page.getByText('Résultat prouvé : Faux', { exact: true })).toBeVisible({
    timeout: 150000,
  });
});

test('offline verifier links identify source scope and fit on mobile', async ({ page }) => {
  const { generateKeyPairSync } = await import('node:crypto');
  const jwk = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({
    format: 'jwk',
  });
  await page.route('**/api/offline-verifier/status', (route) =>
    route.fulfill({
      json: { available: true, platform: 'win32-x64', bytes: 280 * 1048576 },
      headers: { 'X-Clair-Protocol': '5' },
    }),
  );
  await page.route('**/api/issuers', (route) =>
    route.fulfill({
      json: [{ id: 'source-1', name: 'Source de test', jwk }],
      headers: { 'X-Clair-Protocol': '5' },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Sources de confiance', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Télécharger le vérificateur hors ligne' }),
  ).toHaveAttribute('href', '/api/offline-verifier');
  await expect(
    page.getByRole('link', { name: 'Télécharger le vérificateur pour Source de test' }),
  ).toHaveAttribute('href', '/api/offline-verifier?issuer=source-1');
  await expect(page.getByText(/révocations et changements de clés ultérieurs/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
