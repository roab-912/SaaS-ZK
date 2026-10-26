// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CircuitCatalog } from '../../../../src/features/circuits/CircuitCatalog.jsx';
import { ENGINE, PLONK_ENGINE } from '../../../../shared/engines.mjs';
test('catalog offers direct selection and keeps engine choice in advanced options', async () => {
  const choose = vi.fn();
  render(<CircuitCatalog onChoose={choose} />);
  expect(screen.getAllByRole('button', { name: /^Utiliser / })).toHaveLength(4);
  await userEvent.click(
    screen.getByRole('button', { name: 'Utiliser Revenu supérieur à un seuil' }),
  );
  expect(choose).toHaveBeenLastCalledWith('revenue', ENGINE);
  await userEvent.click(screen.getByText('Options avancées'));
  await userEvent.selectOptions(screen.getByLabelText('Moteur de preuve'), PLONK_ENGINE);
  await userEvent.click(screen.getByRole('button', { name: 'Utiliser Condition de majorité' }));
  expect(choose).toHaveBeenLastCalledWith('age', PLONK_ENGINE);
});
test('pending selection prevents multiple submissions and engine changes', () => {
  render(<CircuitCatalog onChoose={vi.fn()} pending="age" />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByLabelText('Moteur de preuve')).toBeDisabled();
});
