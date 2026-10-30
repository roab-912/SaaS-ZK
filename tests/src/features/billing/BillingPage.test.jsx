// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Billing } from '../../../../src/features/billing/BillingPage.jsx';
import { api } from '../../../../src/lib/api.js';
const plans = [
  {
    id: 'essential',
    name: 'Clair Essentiel',
    circuits: 10,
    proofs: 100,
    generations: 100,
    available: true,
    price: {
      amount: 1900,
      currency: 'eur',
      interval: 'month',
      intervalCount: 1,
      taxBehavior: 'inclusive',
    },
  },
  {
    id: 'pro',
    name: 'Clair Pro',
    circuits: 100,
    proofs: 1000,
    generations: 1000,
    available: true,
    price: { amount: 4900, currency: 'eur', interval: 'month', intervalCount: 1 },
  },
];
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
test('unconfigured billing neither advertises free plans nor activates a local trial', () => {
  api.mockClear();
  render(
    <Billing
      session={{
        user: null,
        billingMode: 'demo',
        plans: plans.map((p) => ({ ...p, price: null })),
      }}
      login={vi.fn()}
      refresh={vi.fn()}
      notify={vi.fn()}
    />,
  );
  expect(
    screen
      .getAllByRole('button', { name: 'Configurer Stripe pour souscrire' })
      .every((b) => b.disabled),
  ).toBe(true);
  expect(screen.queryByText('0 €')).toBeNull();
  expect(screen.getByText(/Le compte reste inactif/)).toBeVisible();
  expect(api).not.toHaveBeenCalled();
});
test('Stripe prices and one-trial eligibility drive the checkout buttons for both plans', async () => {
  api.mockImplementation(async (path) => (path === '/billing/plans' ? plans : {}));
  const props = {
    session: {
      user: { active: false, trialEligible: true },
      billingMode: 'stripe',
      paymentEnvironment: 'test',
      plans: [],
    },
    login: vi.fn(),
    refresh: vi.fn(),
    notify: vi.fn(),
    onOpen: vi.fn(),
  };
  const view = render(<Billing {...props} />);
  const pro = await screen.findByRole('button', { name: 'Essayer Clair Pro pendant 30 jours' });
  expect(screen.getByText('19,00 €')).toBeVisible();
  expect(screen.getByText('49,00 €')).toBeVisible();
  await userEvent.click(pro);
  expect(props.onOpen).toHaveBeenCalledWith('checkout', 'pro');
  view.rerender(
    <Billing
      {...props}
      session={{ ...props.session, user: { active: false, trialEligible: false } }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Choisir Clair Pro' })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Essayer/ })).toBeNull();
});
