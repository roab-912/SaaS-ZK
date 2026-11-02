// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Guide } from '../../../../src/features/guide/GuidePage.jsx';
test('guide distinguishes proof validity from provenance and identifies public metadata', async () => {
  render(<Guide />);
  expect(screen.getByText(/librement déclarées/)).toBeVisible();
  await userEvent.click(screen.getByText('Qu’est-ce qui quitte mon appareil ?'));
  await userEvent.click(screen.getByText('Et dans six mois ?'));
  expect(screen.getByText(/ne doivent pas contenir de secrets/)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Et dans six mois ?' })).toBeVisible();
});

test('the guide offers direct entry to models and public verification', async () => {
  const navigate = vi.fn();
  render(<Guide onNavigate={navigate} />);
  await userEvent.click(screen.getByRole('button', { name: 'Choisir un modèle' }));
  expect(navigate).toHaveBeenLastCalledWith('circuits');
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier un fichier reçu' }));
  expect(navigate).toHaveBeenLastCalledWith('verify');
});
