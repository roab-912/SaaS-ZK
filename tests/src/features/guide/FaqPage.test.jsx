// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Faq } from '../../../../src/features/guide/FaqPage.jsx';
test('FAQ keeps all answers, their disclosures and privacy information separate from the diagram', async () => {
  render(<Faq />);
  expect(document.querySelectorAll('details')).toHaveLength(8);
  expect(screen.queryByRole('figure')).toBeNull();
  const question = screen.getByText('Qu’est-ce qui quitte mon appareil ?');
  const answer = screen.getByText(/ne doivent pas contenir de secrets/);
  expect(answer).not.toBeVisible();
  await userEvent.click(question);
  expect(answer).toBeVisible();
  await userEvent.click(question);
  expect(answer).not.toBeVisible();
  await userEvent.click(screen.getByText('Et dans six mois ?'));
  expect(screen.getByText(/Une attestation peut expirer/)).toBeVisible();
  expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-02');
});
test('FAQ provides a direct return to the explanation', async () => {
  const navigate = vi.fn();
  render(<Faq onNavigate={navigate} />);
  await userEvent.click(screen.getByRole('button', { name: 'Comprendre le zero knowledge' }));
  expect(navigate).toHaveBeenCalledWith('guide');
});

test('topic filters and accent-insensitive search narrow answers locally and can be reset', async () => {
  render(<Faq />);
  await userEvent.click(screen.getByRole('button', { name: 'Confidentialité', exact: true }));
  expect(document.querySelectorAll('details')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Confidentialité', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('status')).toHaveTextContent('2 réponses');
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Rechercher une réponse' }),
    'APPAREIL',
  );
  expect(document.querySelectorAll('details')).toHaveLength(1);
  await userEvent.clear(screen.getByRole('searchbox'));
  await userEvent.type(screen.getByRole('searchbox'), 'inexistant');
  expect(screen.getByText('Aucune réponse pour cette recherche.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
  expect(document.querySelectorAll('details')).toHaveLength(8);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Toutes les questions', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await userEvent.type(screen.getByRole('searchbox'), 'REVOQUE');
  expect(screen.getByRole('status')).toHaveTextContent('0 réponses');
  await userEvent.clear(screen.getByRole('searchbox'));
  await userEvent.type(screen.getByRole('searchbox'), 'CLES');
  expect(document.querySelectorAll('details')).toHaveLength(1);
  expect(screen.getByText('Comment fonctionne le vérificateur hors ligne ?')).toBeVisible();
});
