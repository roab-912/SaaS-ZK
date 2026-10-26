// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminDashboard } from '../../../../src/features/admin/AdminDashboard.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
test('dashboard displays aggregate data and reports denied access', async () => {
  api.mockResolvedValueOnce({
    users: 12,
    activeSubscriptions: 4,
    circuits: 30,
    proofs: 80,
    generations: 15,
    period: '2026-10',
    paymentEnvironment: 'test',
    plans: [{ id: 'pro', name: 'Clair Pro' }],
    subscriptions: [{ plan: 'pro', count: 4 }],
    statuses: [{ status: 'active', count: 4 }],
  });
  const view = render(<AdminDashboard />);
  expect(await screen.findByText('12')).toBeVisible();
  expect(screen.getByText('Clair Pro')).toBeVisible();
  expect(screen.getByText(/aucun paiement réel/)).toBeVisible();
  view.unmount();
  api.mockRejectedValueOnce(Error('Accès administrateur requis.'));
  render(<AdminDashboard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès administrateur');
});
