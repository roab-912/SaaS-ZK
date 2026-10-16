// @vitest-environment jsdom
import React, { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../../../../src/features/circuits/CircuitEditor.jsx';
import { template } from '../../../../shared/circuit.mjs';
test('editor saves valid nested rules and disables invalid unused inputs', async () => {
  const save = vi.fn();
  function Harness() {
    const [c, set] = useState(template('list'));
    return <Editor draft={c} setDraft={set} onSave={save} />;
  }
  render(<Harness />);
  await userEvent.selectOptions(screen.getByLabelText('Bloc niveau 0'), 'and');
  expect(screen.getAllByLabelText('Bloc niveau 1')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer et prouver' }));
  expect(save).toHaveBeenCalledWith(true);
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter une entrée' }));
  expect(screen.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer l’entrée Valeur 2' }));
  expect(screen.getByRole('button', { name: 'Enregistrer', exact: true })).toBeEnabled();
  await userEvent.selectOptions(screen.getByLabelText('Bloc niveau 0'), 'in');
  const values = screen.getByLabelText('Valeurs de la liste');
  await userEvent.clear(values);
  await userEvent.type(values, '1, 2, 3');
  expect(screen.getByText('Votre règle est prête')).toBeVisible();
});
