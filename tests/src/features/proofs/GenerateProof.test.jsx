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
  expect(download).toHaveBeenCalledWith(envelope, envelope.circuit.name + '.preuve.clair');
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans mon espace' }));
  expect(api).toHaveBeenCalledWith('/proofs', envelope);
  await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la vérification' }));
  expect(verify).toHaveBeenCalledWith(envelope);
});

test('empty fields and legacy false results explain the failure before any request', async () => {
  vi.clearAllMocks();
  const p = await proofFixture();
  render(
    <Generate
      circuit={{ schema: p.circuit }}
      notify={vi.fn()}
      refresh={vi.fn()}
      onVerify={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Date de naissance : valeur requise');
  fireEvent.change(screen.getByLabelText('Date de naissance', { exact: true }), {
    target: { value: '2015-01-01' },
  });
  fireEvent.change(screen.getByLabelText('Né au plus tard le', { exact: true }), {
    target: { value: '2008-09-21' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La règle donne faux');
  expect(screen.getByRole('alert')).toHaveTextContent('Vrai ou faux');
  expect(api).not.toHaveBeenCalled();
  expect(compileForEngine).not.toHaveBeenCalled();
  expect(launchProof).not.toHaveBeenCalled();
});

test('inline signing is local and editing a signed value requires a new signature', async () => {
  const { webcrypto, generateKeyPairSync } = await import('node:crypto');
  const { keyFingerprint } = await import('../../../../shared/attestations.mjs');
  const { circuitHash } = await import('../../../../shared/circuit.mjs');
  const { contextField, buildProofEnvelope } = await import('../../../../shared/proof.mjs');
  const { ENGINE } = await import('../../../../shared/engines.mjs');
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
      pub = pair.publicKey.export({ format: 'jwk' }),
      priv = pair.privateKey.export({ format: 'jwk' });
    const c = {
      version: 2,
      name: 'Valeur signée',
      description: '',
      inputs: [
        {
          id: 'income',
          label: 'Revenu public',
          type: 'number',
          visibility: 'public',
          source: 'signed',
          attestation: {
            issuerId: 'source-1',
            keyHash: await keyFingerprint(pub),
            claim: 'income_monthly_eur',
          },
        },
      ],
      root: {
        kind: 'op',
        op: 'eq',
        args: [
          { kind: 'input', id: 'income' },
          { kind: 'constant', type: 'number', value: 3000 },
        ],
      },
    };
    const hash = await circuitHash(c);
    api.mockImplementation(async (path) =>
      path === '/issuers' ? [{ id: 'source-1', name: 'Source', jwk: pub }] : {},
    );
    compileForEngine.mockResolvedValue({ hash, engine: ENGINE });
    launchProof.mockImplementation((payload) => ({
      cancel: vi.fn(),
      promise: Promise.resolve(
        buildProofEnvelope({
          engine: ENGINE,
          circuit: c,
          circuitHash: hash,
          publicInputs: [
            contextField(hash),
            '0x0',
            '0x' + Number(payload.values.income).toString(16),
          ],
          proof: 'AAAA',
          attestations: payload.attestations,
        }),
      ),
    }));
    render(
      <Generate circuit={{ schema: c }} notify={vi.fn()} refresh={vi.fn()} onVerify={vi.fn()} />,
    );
    expect(
      screen.getByLabelText('Importer l’attestation pour Revenu public', { exact: true }),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Importer l’attestation pour Revenu public', { exact: true }),
    ).toHaveAttribute('accept', '.clair');
    expect(
      screen.getByRole('button', { name: 'Signer Revenu public', exact: true }),
    ).not.toBeVisible();
    await userEvent.click(screen.getByText('Signer manuellement avec une clé privée'));
    const value = screen.getByLabelText('Revenu public', { exact: true }),
      key = screen.getByLabelText('Clé privée pour Revenu public', { exact: true });
    fireEvent.change(value, { target: { value: '3000' } });
    fireEvent.change(key, { target: { value: JSON.stringify(priv) } });
    await userEvent.click(
      screen.getByRole('button', { name: 'Signer Revenu public', exact: true }),
    );
    expect(
      await screen.findByText('Attestation chargée · source-1', { exact: true }),
    ).toBeVisible();
    expect(key).toHaveValue('');
    fireEvent.change(value, { target: { value: '3001' } });
    await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('attestation est requise');
    expect(launchProof).not.toHaveBeenCalled();
    fireEvent.change(key, { target: { value: JSON.stringify(priv) } });
    await userEvent.click(
      screen.getByRole('button', { name: 'Signer Revenu public', exact: true }),
    );
    await screen.findByText('Attestation chargée · source-1', { exact: true });
    await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve' }));
    expect(await screen.findByText('Résultat prouvé : Faux', { exact: true })).toBeVisible();
    expect(launchProof.mock.lastCall[0].attestations[0].attestation.value).toBe(3001);
    expect(JSON.stringify(launchProof.mock.calls)).not.toContain(priv.d);
    expect(JSON.stringify(api.mock.calls)).not.toContain(priv.d);
  } finally {
    vi.unstubAllGlobals();
  }
});
