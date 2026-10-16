// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Guide } from '../../../../src/features/guide/GuidePage.jsx';
test('guide distinguishes proof validity from provenance and identifies public metadata', () => {
  render(<Guide />);
  expect(screen.getByText(/librement déclarées/)).toBeVisible();
  expect(screen.getByText(/ne doivent pas contenir de secrets/)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Et dans six mois ?' })).toBeVisible();
});
