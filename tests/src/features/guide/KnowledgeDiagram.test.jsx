// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeDiagram } from '../../../../src/features/guide/KnowledgeDiagram.jsx';
test('illustration distinguishes the local data and the public result, including false statements', async () => {
  render(<KnowledgeDiagram />);
  const device = screen.getByRole('region', { name: 'Sur votre appareil' }),
    recipient = screen.getByRole('region', { name: 'Chez le destinataire' });
  expect(within(device).getByText('24 ans', { exact: true })).toBeVisible();
  expect(recipient).not.toHaveTextContent('24 ans');
  expect(screen.getByRole('status')).toHaveTextContent('Résultat de l’exemple : Vrai');
  await userEvent.click(screen.getByRole('button', { name: 'Personne de 16 ans' }));
  expect(screen.getByRole('button', { name: 'Personne de 16 ans' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(device).getByText('16 ans', { exact: true })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Résultat de l’exemple : Faux');
  expect(recipient).not.toHaveTextContent('16 ans');
  expect(screen.getByText(/Cette illustration ne génère pas de fichier de preuve/)).toBeVisible();
  expect(screen.getByText(/Sans signature, les données restent déclarées/)).toBeVisible();
});
