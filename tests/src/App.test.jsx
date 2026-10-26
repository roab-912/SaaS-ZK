// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

test('ready model opens data entry directly, reuses the saved circuit, and custom creation stays available', async () => {
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
  expect(api.mock.calls.filter(([path, body]) => path === '/circuits' && body)).toHaveLength(1);
  expect(JSON.stringify(api.mock.calls)).not.toContain('87654');
  await userEvent.click(screen.getByRole('button', { name: /^Mes circuits/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Circuit personnalisé', exact: true }));
  expect(await screen.findByLabelText('Nom du circuit')).toHaveValue('Nouveau circuit');
});
test('a refused ready-circuit save displays the server error and keeps the catalog accessible', async () => {
  api.mockImplementation(async (path, body) => {
    if (path === '/session') return { user: { id: 'u', email: 'u@example.test', active: true } };
    if (path === '/circuits' && body) throw Error('Limite de circuits atteinte.');
    return [];
  });
  render(<App />);
  await screen.findByRole('heading', { name: 'Prouvez l’essentiel. Gardez le reste privé.' });
  await userEvent.click(screen.getByRole('button', { name: 'Créer un circuit', exact: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Utiliser Condition de majorité' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Limite de circuits atteinte.');
  expect(screen.getByRole('heading', { name: 'Que souhaitez-vous prouver ?' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Utiliser Condition de majorité' })).toBeEnabled();
});
