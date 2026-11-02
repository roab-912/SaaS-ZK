// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Guide } from '../../../../src/features/guide/GuidePage.jsx';
test('understanding page explains validity and provenance and separates the FAQ', () => {
  render(<Guide />);
  expect(screen.getByRole('heading', { name: 'Comprendre le zero knowledge' })).toBeVisible();
  expect(screen.getByText(/librement déclarées/)).toBeVisible();
  expect(screen.getByRole('figure')).toHaveAccessibleName('De vos données à la preuve');
  expect(screen.queryByText('Et dans six mois ?')).toBeNull();
  expect(document.querySelector('details')).toBeNull();
});
test('understanding offers models, verification and its separate FAQ', async () => {
  const navigate = vi.fn();
  render(<Guide onNavigate={navigate} />);
  for (const [name, page] of [
    ['Choisir un modèle', 'circuits'],
    ['Vérifier un fichier reçu', 'verify'],
    ['Consulter la FAQ', 'faq'],
  ]) {
    await userEvent.click(screen.getByRole('button', { name }));
    expect(navigate).toHaveBeenLastCalledWith(page);
  }
});
