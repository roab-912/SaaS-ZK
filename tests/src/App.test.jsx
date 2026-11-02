// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App.jsx';
import { api } from '../../src/lib/api.js';
vi.mock('../../src/lib/api.js', () => ({ api: vi.fn() }));
afterEach(() => window.history.replaceState({}, '', '/'));
test('anonymous app opens public verification and gates editor through signup', async () => {
  api.mockResolvedValue({ user: null, billingMode: 'demo', paymentEnvironment: 'demo' });
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Créer un circuit', exact: true }));
  expect(screen.getByRole('dialog')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Fermer', exact: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier une preuve', exact: true }));
  expect(screen.getByText('Déposez votre preuve ici')).toBeVisible();
});
test('inactive subscribers keep archives but are sent to billing before creation', async () => {
  api.mockImplementation(async (path) =>
    path === '/session'
      ? {
          user: { id: 'u', email: 'u@example.test', active: false },
          billingMode: 'demo',
          paymentEnvironment: 'demo',
        }
      : [],
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'Créer un circuit', exact: true }));
  expect(screen.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Mes preuves', exact: true }));
  expect(screen.getByText('Vos preuves vous attendront ici.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
  expect(api).toHaveBeenCalledWith('/auth/logout', {});
  expect(window.location.pathname).toBe('/connexion');
  expect(screen.getByText('Heureux de vous retrouver.')).toBeVisible();
});

test('attestation emission is accessible without a paid account or proof creation', async () => {
  api.mockImplementation(async (path) =>
    path === '/session' ? { user: null, billingMode: 'demo', paymentEnvironment: 'demo' } : [],
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'Sources de confiance', exact: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Créer une attestation', exact: true }));
  expect(
    await screen.findByRole('heading', { name: 'Créer une attestation', exact: true }),
  ).toBeVisible();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(await screen.findByText(/Aucune source approuvée disponible/)).toBeVisible();
});

test('dedicated signup/login URLs are reachable and browser back follows navigation', async () => {
  window.history.replaceState({}, '', '/connexion');
  api.mockResolvedValue({ user: null, billingMode: 'demo', paymentEnvironment: 'demo' });
  const view = render(<App />);
  expect(await screen.findByText('Heureux de vous retrouver.')).toBeVisible();
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
  expect(window.location.pathname).toBe('/inscription');
  expect(screen.getByText('Votre espace de confiance.')).toBeVisible();
  view.unmount();
  window.history.replaceState({}, '', '/');
});

test('browsing ready models opens data entry without saving and custom creation stays available', async () => {
  const records = [];
  api.mockImplementation(async (path, body) => {
    if (path === '/session') return { user: { id: 'u', email: 'u@example.test', active: true } };
    if (path === '/circuits' && body) {
      const record = { id: 'ready', hash: 'a'.repeat(64), schema: body };
      records.push(record);
      return record;
    }
    return path === '/circuits' ? records : [];
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'Créer un circuit', exact: true }));
  expect(screen.getByRole('heading', { name: 'Que souhaitez-vous prouver ?' })).toBeVisible();
  expect(screen.queryByLabelText('Nom du circuit')).toBeNull();
  await userEvent.click(
    screen.getByRole('button', { name: 'Utiliser Revenu supérieur à un seuil' }),
  );
  expect(await screen.findByRole('heading', { name: 'Générer une preuve' })).toBeVisible();
  expect(screen.getByLabelText('Revenus mensuels', { exact: true })).toHaveValue(null);
  expect(screen.getByLabelText('Seuil mensuel en euros', { exact: true })).toHaveValue(2000);
  await userEvent.type(screen.getByLabelText('Revenus mensuels', { exact: true }), '87654');
  await userEvent.click(screen.getByRole('button', { name: /^Mes circuits/ }));
  await userEvent.click(
    screen.getByRole('button', { name: 'Utiliser Revenu supérieur à un seuil' }),
  );
  await screen.findByRole('heading', { name: 'Générer une preuve' });
  expect(screen.getByLabelText('Revenus mensuels', { exact: true })).toHaveValue(null);
  expect(api.mock.calls.filter(([path, body]) => path === '/circuits' && body)).toHaveLength(0);
  expect(JSON.stringify(api.mock.calls)).not.toContain('87654');
  await userEvent.click(screen.getByRole('button', { name: /^Mes circuits/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Circuit personnalisé', exact: true }));
  expect(await screen.findByLabelText('Nom du circuit')).toHaveValue('Nouveau circuit');
});

test('personalizing a majority template with a signed input saves only the modified circuit', async () => {
  const { webcrypto, generateKeyPairSync } = await import('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
  try {
    const pub = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    });
    const records = [];
    api.mockImplementation(async (path, body) => {
      if (path === '/session') return { user: { id: 'u', email: 'u@example.test', active: true } };
      if (path === '/issuers') return [{ id: 'source-1', name: 'Source approuvée', jwk: pub }];
      if (path === '/circuits' && body) {
        const r = { id: 'signed', hash: 'a'.repeat(64), schema: body };
        records.push(r);
        return r;
      }
      return path === '/circuits' ? [...records] : [];
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
    await userEvent.click(screen.getByRole('button', { name: /Condition de majorité/ }));
    await screen.findByRole('heading', { name: 'Générer une preuve' });
    expect(api.mock.calls.filter(([p, b]) => p === '/circuits' && b)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Personnaliser ce circuit' }));
    await screen.findAllByRole('option', { name: /Source approuvée/ });
    await userEvent.selectOptions(
      screen.getByLabelText('Source de Date de naissance', { exact: true }),
      'issuer:source-1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    await screen.findByRole('heading', { name: 'Mes circuits', exact: true });
    expect(records).toHaveLength(1);
    expect(records[0].schema.inputs.find((i) => i.id === 'birth').source).toBe('signed');
    expect(api.mock.calls.filter(([p, b]) => p === '/circuits' && b)).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('returning from billing restores the requested workspace and clears its query on navigation', async () => {
  history.replaceState({}, '', '/?view=circuits');
  api.mockImplementation(async (path) =>
    path === '/session' ? { user: { id: 'u', email: 'u@example.test', active: true } } : [],
  );
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'Que souhaitez-vous prouver ?' }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Vue d’ensemble', exact: true }));
  expect(location.search).toBe('');
  history.replaceState({}, '', '/?view=circuits');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(
    await screen.findByRole('heading', { name: 'Que souhaitez-vous prouver ?' }),
  ).toBeVisible();
});

test('personal space opens from its sidebar and breadcrumb and survives a direct visit', async () => {
  api.mockImplementation(async (path) =>
    path === '/session'
      ? { user: { id: 'personal-user', email: 'personal@example.test', active: false } }
      : [],
  );
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir mon espace personnel' }));
  expect(await screen.findByRole('heading', { name: 'Votre espace personnel' })).toBeVisible();
  expect(location.pathname).toBe('/espace-personnel');
  expect(screen.getByText('personal@example.test')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir mes preuves' }));
  expect(screen.getByRole('heading', { name: 'Mes preuves' })).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'Espace personnel', exact: true }));
  expect(screen.getByRole('heading', { name: 'Votre espace personnel' })).toBeVisible();
});
test('a direct personal-space URL restores the page and offers authentication to visitors', async () => {
  history.replaceState({}, '', '/espace-personnel');
  api.mockResolvedValue({ user: null });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Votre espace personnel' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier une preuve sans compte' }));
  expect(screen.getByText('Déposez votre preuve ici')).toBeVisible();
});

test('FAQ and understanding have distinct public entry points', async () => {
  api.mockResolvedValue({ user: null });
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'FAQ', exact: true }));
  expect(location.pathname).toBe('/faq');
  expect(screen.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  expect(screen.queryByRole('figure')).toBeNull();
  await userEvent.click(
    within(screen.getByRole('main')).getByRole('button', {
      name: 'Comprendre le zero knowledge',
      exact: true,
    }),
  );
  expect(location.pathname).toBe('/comprendre');
  expect(screen.getByRole('figure')).toBeVisible();
  expect(screen.queryByText('Et dans six mois ?')).toBeNull();
});
test.each([
  ['/faq', 'Questions fréquentes'],
  ['/comprendre', 'Comprendre le zero knowledge'],
])('direct public URL %s restores its own page', async (path, title) => {
  history.replaceState({}, '', path);
  api.mockResolvedValue({ user: null });
  render(<App />);
  expect(await screen.findByRole('heading', { name: title, exact: true })).toBeVisible();
});
