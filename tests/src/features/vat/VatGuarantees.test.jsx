// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VatGuarantees } from '../../../../src/features/vat/VatGuarantees.jsx';

test('explains completeness, the trusted authority and fiscal scope through accessible disclosures', async () => {
  render(<VatGuarantees />);
  expect(screen.getByRole('heading', { name: 'Ce que la preuve garantit' })).toBeVisible();
  expect(screen.getByText(/chaque identifiant de pièce est unique/)).toBeVisible();
  await userEvent.click(screen.getByText('Comment l’exhaustivité est-elle garantie ?'));
  expect(screen.getByText(/pour 100 pièces certifiées/)).toBeVisible();
  expect(screen.getByText(/Il ne nécessite pas de faire confiance à l’entreprise/)).toBeVisible();
  await userEvent.click(screen.getByText('Quelles règles de TVA sont appliquées ?'));
  expect(screen.getByText('Le rattachement utilise la date de facture.')).toBeVisible();
  await userEvent.click(screen.getByText('Que voit le destinataire et que doit-il vérifier ?'));
  expect(screen.getByText(/Une preuve valide pour septembre/)).toBeVisible();
});

test('legacy proofs do not claim uniqueness was enforced in their circuit', () => {
  render(<VatGuarantees programVersion={1} />);
  expect(screen.getByText(/cet ancien programme ne la contrôle pas séparément/)).toBeVisible();
  expect(screen.queryByText(/Identifiants distincts pour toutes les pièces actives/)).toBeNull();
});
