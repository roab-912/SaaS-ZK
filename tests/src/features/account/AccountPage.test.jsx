// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPage } from '../../../../src/features/account/AccountPage.jsx';

const session = {
  user: {
    id: 'user-1',
    email: 'alice@example.test',
    active: true,
    plan: 'essential',
    expires: Date.UTC(2026, 11, 2),
  },
  usage: {
    circuits: 2,
    proofs: 3,
    generations: 7,
    pending: 1,
    resets: Date.UTC(2026, 11, 1),
    limits: { name: 'Clair Essentiel', circuits: 10, proofs: 100, generations: 100 },
  },
};
test('personal space shows the authenticated account and actual subscription usage', () => {
  render(
    <AccountPage
      session={session}
      circuits={[{}, {}]}
      proofs={[{}, {}, {}]}
      onNavigate={vi.fn()}
    />,
  );
  expect(screen.getByText('alice@example.test')).toBeVisible();
  expect(screen.getByText('Clair Essentiel')).toBeVisible();
  expect(screen.getByText('Accès jusqu’au 02/12/2026.')).toBeVisible();
  expect(screen.getByRole('progressbar', { name: 'Générations ce mois-ci' })).toHaveAttribute(
    'value',
    '7',
  );
  expect(screen.getByRole('progressbar', { name: 'Circuits enregistrés' })).toHaveAttribute(
    'max',
    '10',
  );
  expect(screen.getByText(/remises à zéro le 01\/12\/2026/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Ouvrir l’administration' })).toBeNull();
});
test('shortcuts open the requested existing workspace pages', async () => {
  const navigate = vi.fn();
  render(<AccountPage session={session} onNavigate={navigate} />);
  for (const [label, page] of [
    ['Ouvrir mes circuits', 'circuits'],
    ['Ouvrir mes preuves', 'proofs'],
    ['Vérifier une preuve', 'verify'],
    ['Gérer mon abonnement', 'billing'],
    ['Consulter le guide', 'guide'],
  ]) {
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(page);
  }
});
test('expired accounts keep archives and public verification with an explicit subscription message', async () => {
  const navigate = vi.fn();
  render(
    <AccountPage session={{ user: { ...session.user, active: false } }} onNavigate={navigate} />,
  );
  expect(screen.getByText('Sans abonnement actif')).toBeVisible();
  expect(screen.getByText(/Vos archives et la vérification restent accessibles/)).toBeVisible();
  expect(screen.queryByText(/Accès jusqu’au/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Choisir un abonnement' }));
  expect(navigate).toHaveBeenCalledWith('billing');
  expect(screen.getByText('Consommation indisponible')).toBeVisible();
});
test('anonymous visitors can connect, register or verify without seeing another account', async () => {
  const navigate = vi.fn();
  render(<AccountPage session={{ user: null }} onNavigate={navigate} />);
  expect(screen.queryByText('alice@example.test')).toBeNull();
  for (const [label, page] of [
    ['Se connecter', 'login'],
    ['Créer un compte', 'register'],
    ['Vérifier une preuve sans compte', 'verify'],
  ]) {
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(page);
  }
});
test('trial dates and administrative access reflect the current session', async () => {
  const navigate = vi.fn();
  render(
    <AccountPage
      session={{ ...session, user: { ...session.user, admin: true, trialActive: true } }}
      onNavigate={navigate}
    />,
  );
  expect(screen.getByText('Essai en cours')).toBeVisible();
  expect(screen.getByText('Fin de l’essai le 02/12/2026.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir l’administration' }));
  expect(navigate).toHaveBeenCalledWith('admin');
});
