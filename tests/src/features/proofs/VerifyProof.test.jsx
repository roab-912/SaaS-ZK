// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Verify } from '../../../../src/features/proofs/VerifyProof.jsx';
import { proofFixture } from '../../../helpers/proof.mjs';
import { compileForEngine, launchProof } from '../../../../src/lib/zk-client.js';
vi.mock('../../../../src/lib/zk-client.js', () => ({
  compileForEngine: vi.fn(async () => ({})),
  launchProof: vi.fn(() => ({ promise: Promise.resolve({ valid: true }), cancel: vi.fn() })),
}));
test('verifier displays actual statement and checks requested fingerprint before proving', async () => {
  const envelope = await proofFixture(),
    notify = vi.fn();
  render(<Verify initial={envelope} notify={notify} />);
  expect(screen.getByText('21/09/2008')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier la preuve', exact: true }));
  expect(await screen.findByText('Preuve valide')).toBeVisible();
  expect(compileForEngine).toHaveBeenCalledWith(envelope.circuit, envelope.engine);
  await userEvent.type(screen.getByPlaceholderText(/SHA-256/), '0'.repeat(64));
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier la preuve', exact: true }));
  expect(await screen.findByText('Preuve invalide', { exact: true })).toBeVisible();
  expect(launchProof).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('empreinte'), true);
});
test('invalid imports never enter the worker', async () => {
  const notify = vi.fn();
  render(<Verify initial={null} notify={notify} />);
  expect(screen.getByLabelText('Fichier de preuve')).toHaveAttribute('accept', '.clair');
  const file = new File(['bad'], 'bad.clair', { type: 'application/json' });
  file.text = async () => '{bad';
  await userEvent.upload(screen.getByLabelText('Fichier de preuve'), file);
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('valide'), true);
  expect(screen.getByRole('button', { name: 'Vérifier la preuve', exact: true })).toBeDisabled();
});

test('printing renders only the public report during print and then removes it', async () => {
  const envelope = await proofFixture();
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const report = screen.getByRole('article', { name: 'Rapport public de vérification' });
    expect(report).toHaveTextContent('21/09/2008');
    expect(report).not.toHaveTextContent('AAAA');
  });
  render(<Verify initial={envelope} notify={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Imprimer le rapport public' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier la preuve', exact: true }));
  await screen.findByText('Preuve valide');
  expect(screen.queryByRole('article')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Imprimer le rapport public' }));
  expect(print).toHaveBeenCalledOnce();
  expect(screen.queryByRole('article')).toBeNull();
  print.mockRestore();
});
