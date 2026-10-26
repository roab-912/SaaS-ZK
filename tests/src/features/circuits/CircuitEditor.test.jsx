// @vitest-environment jsdom
import React, { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../../../../src/features/circuits/CircuitEditor.jsx';
import { template, validateCircuit } from '../../../../shared/circuit.mjs';
import { download } from '../../../../src/lib/files.js';
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
test('exports only a valid public circuit schema', async () => {
  const draft = template('blank');
  render(<Editor draft={draft} setDraft={vi.fn()} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Exporter le circuit public' }));
  expect(download).toHaveBeenLastCalledWith(validateCircuit(draft), draft.name + '.circuit.clair');
});
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

test('engine selector preserves the rule and includes the experimental status', async () => {
  const { ZK_ENGINES, ENGINE, FFLONK_ENGINE } = await import('../../../../shared/engines.mjs');
  const save = vi.fn(),
    initial = template();
  function Harness() {
    const [c, set] = useState(initial);
    return <Editor draft={c} setDraft={set} onSave={() => save(c)} />;
  }
  render(<Harness />);
  expect(screen.getByLabelText('Moteur de preuve')).toHaveValue(ENGINE);
  for (const engine of ZK_ENGINES) {
    await userEvent.selectOptions(screen.getByLabelText('Moteur de preuve'), engine.id);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    expect(save).toHaveBeenLastCalledWith({ ...initial, engine: engine.id });
  }
  expect(screen.getByRole('option', { name: /FFLONK.*Expérimental/ }).value).toBe(FFLONK_ENGINE);
});

test('comparison changes preserve both operands and save errors stay visible', async () => {
  const initial = { ...template(), version: 2 },
    save = vi.fn(async () => {
      throw Error('Le serveur doit être relancé.');
    });
  function Harness() {
    const [c, set] = useState(initial);
    return <Editor draft={c} setDraft={set} onSave={() => save(c)} />;
  }
  render(<Harness />);
  await userEvent.selectOptions(screen.getByLabelText('Bloc niveau 0'), 'gte');
  expect(screen.getAllByLabelText('Entrée utilisée').map((e) => e.value)).toEqual([
    'birth',
    'cutoff',
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  expect(save).toHaveBeenCalledWith({ ...initial, root: { ...initial.root, op: 'gte' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('relancé');
  await userEvent.clear(screen.getByLabelText('Nom du circuit'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Nom du circuit : ce champ ne peut pas être vide.',
  );
  expect(screen.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
});

test('removing birth leaves a usable integer equals 18 circuit with no hidden reference', async () => {
  const save = vi.fn();
  function Harness() {
    const [c, set] = useState({ ...template(), version: 2 });
    return <Editor draft={c} setDraft={set} onSave={() => save(c)} />;
  }
  render(<Harness />);
  await userEvent.click(
    screen.getByRole('button', { name: 'Supprimer l’entrée Date de naissance' }),
  );
  expect(screen.getAllByLabelText('Entrée utilisée').map((e) => e.value)).toEqual([
    'cutoff',
    'cutoff',
  ]);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /^Type/ }), 'number');
  await userEvent.selectOptions(screen.getByLabelText('Bloc niveau 0'), 'eq');
  await userEvent.selectOptions(screen.getAllByLabelText('Bloc niveau 1')[1], 'constant');
  expect(screen.getByText('Votre règle est prête')).toBeVisible();
  expect(screen.queryByText('Entrée inconnue : birth')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Supprimer l’entrée Né au plus tard le' }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  expect(save.mock.lastCall[0].root).toEqual({
    kind: 'op',
    op: 'eq',
    args: [
      { kind: 'input', id: 'cutoff' },
      { kind: 'constant', type: 'number', value: 18 },
    ],
  });
});
test('missing input references are explicit in the selector and can be repaired', async () => {
  const draft = { ...template('blank'), version: 2 };
  draft.root.args[0] = { kind: 'input', id: 'birth' };
  function Harness() {
    const [c, set] = useState(draft);
    return <Editor draft={c} setDraft={set} onSave={vi.fn()} />;
  }
  render(<Harness />);
  expect(
    screen.getByRole('option', { name: 'Choisir une entrée — référence absente : birth' }),
  ).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Entrée utilisée'), 'value_1');
  expect(screen.getByText('Votre règle est prête')).toBeVisible();
});

test('date constants use French notation and incomplete or impossible dates cannot be saved', async () => {
  const save = vi.fn();
  function Harness() {
    const initial = template('age');
    initial.inputs = initial.inputs.slice(0, 1);
    initial.root.args[1] = { kind: 'constant', type: 'date', value: 20000229 };
    const [c, set] = useState(initial);
    return <Editor draft={c} setDraft={set} onSave={() => save(validateCircuit(c))} />;
  }
  render(<Harness />);
  const field = screen.getByLabelText('Valeur fixe');
  expect(field).toHaveValue('29/02/2000');
  await userEvent.clear(field);
  await userEvent.type(field, '31/02/2026');
  expect(field).toHaveValue('31/02/2026');
  expect(screen.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
  await userEvent.clear(field);
  await userEvent.type(field, '01/03/2026');
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  expect(save.mock.lastCall[0].root.args[1].value).toBe(20260301);
});
