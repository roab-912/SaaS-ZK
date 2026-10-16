// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '../../../../src/features/dashboard/Dashboard.jsx';
test('dashboard retains templates, counters and entry to editor', async () => {
  const start = vi.fn(),
    nav = vi.fn();
  render(
    <Dashboard start={start} nav={nav} circuits={[]} proofs={[]} edit={vi.fn()} prove={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Capacité financière/ }));
  expect(start).toHaveBeenCalledWith('income');
  await userEvent.click(screen.getByRole('button', { name: /Zone éligible/ }));
  expect(start).toHaveBeenCalledWith('list');
  await userEvent.click(screen.getByRole('button', { name: 'Tout voir' }));
  expect(nav).toHaveBeenCalledWith('circuits');
  expect(screen.getByText('100 % local')).toBeVisible();
});
