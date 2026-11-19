// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VatGuarantees } from '../../../../src/features/vat/VatGuarantees.jsx';

test('shows the summary and four guarantees without expandable sections', () => {
  render(<VatGuarantees />);
  expect(screen.getByRole('heading', { name: 'Ce que la preuve garantit' })).toBeVisible();
  expect(screen.getByText(/chaque identifiant de pièce est unique/)).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByRole('region').querySelector('details')).toBeNull();
});

test('legacy proofs do not claim uniqueness was enforced in their circuit', () => {
  render(<VatGuarantees programVersion={1} />);
  expect(screen.getByText(/cet ancien programme ne la contrôle pas séparément/)).toBeVisible();
  expect(screen.queryByText(/chaque identifiant de pièce est unique/)).toBeNull();
});
