// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentPage } from '../../../../src/features/billing/PaymentPage.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/features/billing/CheckoutPayment.jsx', () => ({
  CheckoutPayment: ({ onComplete }) => (
    <button onClick={() => onComplete('cs_fixture')}>Valider le formulaire sécurisé</button>
  ),
}));
vi.mock('../../../../src/features/billing/InvoicePayment.jsx', () => ({
  InvoicePayment: () => <div>Paiement en attente</div>,
}));
const plans = [
  {
    id: 'essential',
    name: 'Clair Essentiel',
    available: true,
    circuits: 10,
    proofs: 100,
    generations: 100,
    price: { amount: 1900, currency: 'eur', interval: 'month' },
  },
  {
    id: 'pro',
    name: 'Clair Pro',
    available: true,
    price: { amount: 3999, currency: 'eur', interval: 'month' },
  },
];
const props = () => ({
  session: { user: { id: 'u', plan: 'essential' }, paymentEnvironment: 'test' },
  refresh: vi.fn(),
  login: vi.fn(),
  onExit: vi.fn(),
});
let state, configuration;
beforeEach(() => {
  state = {
    subscription: { plan: 'essential', status: 'trialing', expires: Date.now() + 86400000 },
    card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
  };
  configuration = { publishableKey: 'pk_test_fixture' };
  api.mockReset();
  api.mockImplementation(async (path) => {
    if (path === '/billing/plans') return plans;
    if (path === '/billing/config') return configuration;
    if (path === '/billing/state') return state;
    if (path === '/billing/checkout')
      return { mode: 'subscription', sessionId: 'cs_fixture', trialDays: 30, plan: 'essential' };
    if (path === '/billing/complete') return { status: 'complete' };
    if (path === '/billing/change/preview')
      return {
        plan: 'pro',
        planName: 'Clair Pro',
        price: plans[1].price,
        token: 'a'.repeat(48),
        endsTrial: true,
        amountDueNow: 3999,
        currency: 'eur',
      };
    return {};
  });
});
afterEach(() => history.replaceState({}, '', '/'));
test('subscription checkout renders in Clair and refreshes only after verified completion', async () => {
  history.replaceState({}, '', '/abonnement/paiement?offre=essential');
  const p = props();
  render(<PaymentPage {...p} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Valider le formulaire sécurisé' }),
  );
  await waitFor(() => expect(p.refresh).toHaveBeenCalledTimes(1));
  expect(api).toHaveBeenCalledWith('/billing/complete', { sessionId: 'cs_fixture' });
  expect(await screen.findByText('Votre demande a été confirmée.')).toBeVisible();
});
test('changing offers displays the trial end and amount before asking for confirmation', async () => {
  history.replaceState({}, '', '/abonnement/gestion?offre=pro');
  render(<PaymentPage {...props()} />);
  const confirm = await screen.findByRole('button', { name: 'Confirmer le changement d’offre' });
  expect(screen.getByText(/Ce changement termine immédiatement/)).toBeVisible();
  expect(api.mock.calls.filter(([path]) => path === '/billing/change')).toHaveLength(0);
  await userEvent.click(confirm);
  expect(api).toHaveBeenCalledWith('/billing/change', { plan: 'pro', token: 'a'.repeat(48) });
  expect(await screen.findByText('Votre offre a été mise à jour.')).toBeVisible();
});
test('renewal cancellation requires an explicit confirmation inside Clair', async () => {
  history.replaceState({}, '', '/abonnement/gestion');
  render(<PaymentPage {...props()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Annuler le renouvellement' }));
  expect(api.mock.calls.filter(([path]) => path === '/billing/renewal')).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer', exact: true }));
  expect(api).toHaveBeenCalledWith('/billing/renewal', { cancel: true });
});
test('missing publishable key explains the failure without creating a checkout', async () => {
  configuration = { publishableKey: null };
  history.replaceState({}, '', '/abonnement/paiement');
  render(<PaymentPage {...props()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/pas encore configuré/);
  expect(api.mock.calls.filter(([path]) => path === '/billing/checkout')).toHaveLength(0);
});
test('unauthenticated visitors must log in and never initialize a payment', () => {
  history.replaceState({}, '', '/abonnement/paiement');
  render(<PaymentPage {...props()} session={{ user: null }} />);
  expect(api).not.toHaveBeenCalled();
  expect(screen.queryByText('Valider le formulaire sécurisé')).toBeNull();
});
