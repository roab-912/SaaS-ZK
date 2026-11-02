// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeControl } from '../../../src/components/ThemeControl.jsx';
test('appearance exposes device, light and dark settings with an accessible label', async () => {
  render(<ThemeControl />);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Apparence' }), 'dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'system');
  localStorage.clear();
});
