// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Billing } from '../../../../src/features/billing/BillingPage.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn(async () => ({})) }));
test('anonymous checkout prompts account; demo cancellation calls server', async () => {
  const login = vi.fn(),
    refresh = vi.fn(),
    notify = vi.fn();
  const props = {
    session: { user: null, billingMode: 'demo', paymentEnvironment: 'demo' },
    login,
    refresh,
    notify,
  };
  const view = render(<Billing {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Activer 30 jours de test' }));
  expect(login).toHaveBeenCalledOnce();
  view.rerender(
    <Billing
      {...props}
      session={{
        ...props.session,
        user: { email: 'user@test.fr', active: true, expires: Date.now() + 100000 },
      }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Désactiver l’abonnement de test' }));
  expect(api).toHaveBeenCalledWith('/billing/demo', { action: 'cancel' });
  expect(refresh).toHaveBeenCalled();
});
