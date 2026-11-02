// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoicePayment } from '../../../../src/features/billing/InvoicePayment.jsx';
const mock = vi.hoisted(() => ({
  stripe: { confirmCardPayment: vi.fn(), confirmPayment: vi.fn() },
  elements: {},
}));
vi.mock('../../../../src/lib/stripe-client.js', () => ({
  paymentStripe: () => Promise.resolve({}),
  themedStripeAppearance: () => ({}),
}));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => children,
  useStripe: () => mock.stripe,
  useElements: () => mock.elements,
  PaymentElement: () => <div>Nouvelle carte sécurisée</div>,
}));
beforeEach(() => {
  mock.stripe.confirmCardPayment.mockReset();
  mock.stripe.confirmPayment.mockReset();
});
const props = {
  publishableKey: 'pk_test_fixture',
  payment: { clientSecret: 'pi_fixture_secret_fixture', amount: 3999, currency: 'eur' },
};
test('saved-card SCA is confirmed before server refresh', async () => {
  mock.stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  const onComplete = vi.fn();
  render(<InvoicePayment {...props} onComplete={onComplete} />);
  await userEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/ }));
  expect(mock.stripe.confirmCardPayment).toHaveBeenCalledWith('pi_fixture_secret_fixture');
  expect(onComplete).toHaveBeenCalledTimes(1);
});
test('a refused card offers the secure new-card form and does not mark the payment complete', async () => {
  mock.stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Paiement refusé' } });
  mock.stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  const onComplete = vi.fn();
  render(<InvoicePayment {...props} onComplete={onComplete} />);
  await userEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('Paiement refusé');
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.getByText('Nouvelle carte sécurisée')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /Confirmer le paiement/ }));
  expect(mock.stripe.confirmPayment).toHaveBeenCalledWith(
    expect.objectContaining({ redirect: 'if_required', elements: mock.elements }),
  );
  expect(onComplete).toHaveBeenCalledTimes(1);
});
