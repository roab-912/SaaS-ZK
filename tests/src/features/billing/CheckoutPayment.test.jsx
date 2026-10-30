// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPayment } from '../../../../src/features/billing/CheckoutPayment.jsx';
const mock = vi.hoisted(() => ({ state: null, payment: vi.fn(), wallets: vi.fn() }));
vi.mock('../../../../src/lib/stripe-client.js', () => ({
  paymentStripe: () => Promise.resolve({}),
  stripeAppearance: {},
}));
vi.mock('@stripe/react-stripe-js/checkout', () => ({
  CheckoutElementsProvider: ({ children }) => children,
  useCheckoutElements: () => mock.state,
  PaymentElement: (props) => {
    mock.payment(props);
    return <div>Carte sécurisée</div>;
  },
  ExpressCheckoutElement: (props) => {
    mock.wallets(props);
    return <div>Portefeuilles</div>;
  },
}));
beforeEach(() => {
  mock.state = {
    type: 'success',
    checkout: {
      canConfirm: true,
      currency: 'eur',
      total: { total: { minorUnitsAmount: 0 } },
      confirm: vi.fn(async () => ({ type: 'success', session: { id: 'cs_fixture' } })),
    },
  };
});
const props = {
  publishableKey: 'pk_test_fixture',
  checkout: {
    clientSecret: 'fixture',
    sessionId: 'cs_fixture',
    mode: 'subscription',
    trialDays: 30,
  },
};
test('trial checkout confirms within Clair, exposes the Stripe total and enables supported wallets', async () => {
  const onComplete = vi.fn();
  render(<CheckoutPayment {...props} onComplete={onComplete} />);
  expect(screen.getByText(/régler aujourd/)).toHaveTextContent(/0,00/);
  await userEvent.click(screen.getByRole('button', { name: /Démarrer mes 30 jours/ }));
  expect(mock.state.checkout.confirm).toHaveBeenCalledWith({ redirect: 'if_required' });
  expect(onComplete).toHaveBeenCalledWith('cs_fixture');
  expect(mock.wallets.mock.lastCall[0].options.paymentMethods).toMatchObject({
    applePay: 'auto',
    googlePay: 'auto',
  });
});
test('a declined card is shown to the user and never reports success', async () => {
  mock.state.checkout.confirm.mockResolvedValue({
    type: 'error',
    error: { message: 'Carte refusée' },
  });
  const onComplete = vi.fn();
  render(<CheckoutPayment {...props} onComplete={onComplete} />);
  await userEvent.click(screen.getByRole('button', { name: /Démarrer/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Carte refusée');
  expect(onComplete).not.toHaveBeenCalled();
});
test('loading, configuration errors and incomplete details cannot trigger confirmation', () => {
  mock.state = { type: 'loading' };
  const view = render(<CheckoutPayment {...props} />);
  expect(screen.getByRole('status')).toBeVisible();
  mock.state = { type: 'error' };
  view.rerender(<CheckoutPayment {...props} />);
  expect(screen.getByRole('alert')).toBeVisible();
  mock.state = {
    type: 'success',
    checkout: { canConfirm: false, currency: 'eur', total: { total: { minorUnitsAmount: 1900 } } },
  };
  view.rerender(<CheckoutPayment {...props} />);
  expect(screen.getByRole('button', { name: /Démarrer/ })).toBeDisabled();
});

test('an unexpected SDK rendering failure shows a recoverable message instead of a blank page', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mock.payment.mockImplementation(() => {
    throw Error('SDK unavailable');
  });
  render(<CheckoutPayment {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/Rechargez la page/);
  mock.payment.mockReset();
});
