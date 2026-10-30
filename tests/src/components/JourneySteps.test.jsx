// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { JourneySteps } from '../../../src/components/JourneySteps.jsx';
test('journeys clearly identify the current and completed steps without making future steps actionable', () => {
  render(<JourneySteps steps={['Mes factures', 'Signature', 'Ma preuve']} current={1} />);
  const list = screen.getByRole('list', { name: 'Votre progression' }),
    items = within(list).getAllByRole('listitem');
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByText('Terminé')).toBeVisible();
  expect(items[1]).toHaveAttribute('aria-current', 'step');
  expect(within(items[2]).getByText('À venir')).toBeVisible();
  expect(within(list).queryByRole('button')).toBeNull();
});
