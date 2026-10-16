// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProofLibrary } from '../../../../src/features/proofs/ProofLibrary.jsx';
import { proofFixture } from '../../../helpers/proof.mjs';
import { api } from '../../../../src/lib/api.js';
import { download } from '../../../../src/lib/files.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn(async () => ({})) }));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
test('library downloads, verifies and deletes only the selected public envelope', async () => {
  const envelope = await proofFixture(),
    verify = vi.fn(),
    refresh = vi.fn();
  render(
    <ProofLibrary
      user={{ id: 'u' }}
      nav={vi.fn()}
      setAuth={vi.fn()}
      proofs={[{ id: 'p', created: '2026-09-21', envelope }]}
      openVerify={verify}
      refresh={refresh}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Télécharger' }));
  expect(download).toHaveBeenCalledWith(envelope, expect.any(String));
  await userEvent.click(screen.getByRole('button', { name: 'Vérifier', exact: true }));
  expect(verify).toHaveBeenCalledWith(envelope);
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer la preuve' }));
  expect(api).toHaveBeenCalledWith('/proofs/p', {}, 'DELETE');
  expect(refresh).toHaveBeenCalled();
});
