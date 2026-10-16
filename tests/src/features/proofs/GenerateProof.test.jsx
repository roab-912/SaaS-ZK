// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Generate } from '../../../../src/features/proofs/GenerateProof.jsx';
import { proofFixture } from '../../../helpers/proof.mjs';
import { api } from '../../../../src/lib/api.js';
import { compileForEngine, launchProof } from '../../../../src/lib/zk-client.js';
import { download } from '../../../../src/lib/files.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn(async () => ({})) }));
vi.mock('../../../../src/lib/zk-client.js', () => ({
  compileForEngine: vi.fn(),
  launchProof: vi.fn(),
}));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
test('generation keeps private inputs in worker, clears form and archives only envelope', async () => {
  const envelope = await proofFixture(),
    notify = vi.fn(),
    refresh = vi.fn(),
    verify = vi.fn();
  compileForEngine.mockResolvedValue({ hash: envelope.circuitHash });
  launchProof.mockReturnValue({ promise: Promise.resolve(envelope), cancel: vi.fn() });
  render(
    <Generate
      circuit={{ schema: envelope.circuit }}
      notify={notify}
      refresh={refresh}
      onVerify={verify}
    />,
  );
  fireEvent.change(screen.getByLabelText('Date de naissance', { exact: true }), {
    target: { value: '1991-07-14' },
  });
  fireEvent.change(screen.getByLabelText('Né au plus tard le', { exact: true }), {
    target: { value: '2008-09-21' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve' }));
  expect(await screen.findByText('Preuve prête')).toBeVisible();
  expect(launchProof.mock.calls[0][0].values.birth).toBe('1991-07-14');
  expect(screen.getByLabelText('Date de naissance', { exact: true })).toHaveValue('');
  expect(JSON.stringify(api.mock.calls)).not.toContain('1991');
  expect(compileForEngine).toHaveBeenCalledWith(envelope.circuit);
  await userEvent.click(screen.getByRole('button', { name: 'Télécharger la preuve' }));
  expect(download).toHaveBeenCalledWith(envelope, expect.any(String));
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans mon espace' }));
  expect(api).toHaveBeenCalledWith('/proofs', envelope);
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la vérification' }));
  expect(verify).toHaveBeenCalledWith(envelope);
});
