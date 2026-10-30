// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CircuitTable } from '../../../../src/features/circuits/CircuitTable.jsx';
import { template } from '../../../../shared/circuit.mjs';
test('table routes edit/prove/delete actions to the selected version', async () => {
  const c = { id: 'c', hash: 'a'.repeat(64), schema: template(), created: '2026-09-21' },
    edit = vi.fn(),
    prove = vi.fn(),
    del = vi.fn();
  render(<CircuitTable circuits={[c]} onEdit={edit} onProve={prove} onDelete={del} />);
  await userEvent.click(screen.getByRole('button', { name: /^Condition de majorité/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Générer' }));
  await userEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
  for (const fn of [edit, prove, del]) expect(fn).toHaveBeenCalledWith(c);
});

test('VAT circuits are labeled as signed exhaustive batches', async () => {
  const { vatCircuit } = await import('../../../../shared/vat.mjs');
  render(
    <CircuitTable
      circuits={[{ id: 'vat', hash: 'a'.repeat(64), schema: vatCircuit(), created: '2026-09-21' }]}
      onEdit={vi.fn()}
      onProve={vi.fn()}
    />,
  );
  expect(screen.getByText(/Relevé exhaustif signé · TVA/)).toBeVisible();
});
