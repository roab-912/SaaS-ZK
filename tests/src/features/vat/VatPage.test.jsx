// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ublImport from '../../../../src/features/vat/ubl-import.js';
import { VatPage } from '../../../../src/features/vat/VatPage.jsx';
import { vatFixture } from '../../../helpers/vat.mjs';
import { ublFixture } from '../../../helpers/ubl.mjs';
import { vatSummary } from '../../../../shared/vat.mjs';
import { api } from '../../../../src/lib/api.js';
import { launchProof, compileForEngine } from '../../../../src/lib/zk-client.js';
import { download } from '../../../../src/lib/files.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
vi.mock('../../../../src/lib/zk-client.js', () => ({
  launchProof: vi.fn(),
  compileForEngine: vi.fn(),
}));
test('VAT journey checks the claim and stores only the public circuit and proof, never invoice details', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await ublFixture();
    api.mockImplementation(async (path) =>
      path === '/issuers'
        ? f.issuers
        : path === '/prover/authorize'
          ? { token: 'a'.repeat(32) }
          : {},
    );
    compileForEngine.mockResolvedValue({ hash: f.envelope.circuitHash });
    launchProof.mockReturnValue({ promise: Promise.resolve(f.envelope), cancel: vi.fn() });
    const verify = vi.fn();
    render(<VatPage notify={vi.fn()} refresh={vi.fn()} onVerify={verify} onAuthority={vi.fn()} />);
    const file = new File(['x'], 'factures.clair');
    file.text = async () => JSON.stringify(f.batch);
    await userEvent.click(screen.getByText('J’ai déjà un lot signé'));
    await userEvent.upload(screen.getByLabelText('Lot de factures certifié'), file);
    const amount = await screen.findByLabelText('TVA collectée en euros');
    expect(api.mock.calls.filter(([p]) => p === '/circuits')).toHaveLength(0);
    fireEvent.change(amount, { target: { value: '99999' } });
    await userEvent.click(screen.getByRole('button', { name: 'Générer la preuve TVA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('montant annoncé');
    expect(api.mock.calls.filter(([p]) => p === '/prover/authorize')).toHaveLength(0);
    fireEvent.change(amount, {
      target: { value: (vatSummary(f.imported.draft).net / 100).toFixed(2) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Générer la preuve TVA' }));
    await screen.findByRole('heading', { name: 'Preuve TVA prête' });
    expect(screen.queryByLabelText('TVA collectée en euros')).toBeNull();
    expect(launchProof.mock.lastCall[0].vatBatch.invoices).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger la preuve TVA' }));
    expect(download.mock.lastCall[1]).toBe('TVA.preuve.clair');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans mon espace' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la vérification' }));
    expect(verify).toHaveBeenCalledWith(f.envelope);
    const sent = JSON.stringify(api.mock.calls);
    expect(sent).not.toContain('netCents');
    expect(sent).not.toContain(f.batch.invoices[0].id);
    expect(sent).not.toContain(f.batch.blinding);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('invalid or uncertified imports remain blocked', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await ublFixture();
    api.mockResolvedValue([]);
    render(<VatPage notify={vi.fn()} refresh={vi.fn()} onVerify={vi.fn()} onAuthority={vi.fn()} />);
    const file = new File(['x'], 'factures.clair');
    file.text = async () => JSON.stringify(f.batch);
    await userEvent.click(screen.getByText('J’ai déjà un lot signé'));
    await userEvent.upload(screen.getByLabelText('Lot de factures certifié'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('Source non approuvée');
    expect(screen.queryByRole('button', { name: 'Générer la preuve TVA' })).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

test('a legacy JSON invoice lot without UBL originals cannot be used for a new proof', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await vatFixture();
    render(<VatPage notify={vi.fn()} refresh={vi.fn()} onVerify={vi.fn()} onAuthority={vi.fn()} />);
    const file = new File(['x'], 'factures.clair');
    file.text = async () => JSON.stringify(f.batch);
    await userEvent.click(screen.getByText('J’ai déjà un lot signé'));
    await userEvent.upload(screen.getByLabelText('Lot de factures certifié'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('ne contient pas de factures UBL');
    expect(launchProof).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

test('XML import and local signing continue directly into a proof without an intermediate download', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await ublFixture();
    vi.spyOn(ublImport, 'importUblFiles').mockResolvedValue(f.imported);
    api.mockImplementation(async (path) =>
      path === '/issuers'
        ? f.issuers
        : path === '/prover/authorize'
          ? { token: 'a'.repeat(32) }
          : {},
    );
    compileForEngine.mockResolvedValue({ hash: f.envelope.circuitHash });
    launchProof.mockImplementation((request) => ({
      promise: Promise.resolve(
        request.mode === 'vat-commit'
          ? {
              commitment: f.manifest.commitment,
              companyHash: f.manifest.companyHash,
              blinding: f.batch.blinding,
            }
          : f.envelope,
      ),
      cancel: vi.fn(),
    }));
    render(<VatPage notify={vi.fn()} refresh={vi.fn()} onVerify={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Importer mes factures XML' }));
    await screen.findByRole('heading', { name: 'Préparer mes factures' });
    fireEvent.change(screen.getByLabelText('Importer des factures UBL'), {
      target: { files: [new File(['xml'], 'invoice.xml')] },
    });
    await screen.findByText('2 factures et avoirs prêts');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer vers la signature' }));
    const key = new File(['key'], 'private.clair');
    key.text = async () => JSON.stringify(f.priv);
    await userEvent.upload(screen.getByLabelText('Importer la clé privée TVA'), key);
    await screen.findByText(/Clé de signature chargée/);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Signer le relevé complet' }));
    await screen.findByRole('heading', { name: 'Lot certifié prêt' });
    await userEvent.click(screen.getByRole('button', { name: 'Continuer vers ma preuve' }));
    await screen.findByLabelText('TVA collectée en euros');
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Prouver la TVA collectée' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Générer la preuve TVA' }));
    await screen.findByRole('heading', { name: 'Preuve TVA prête' });
    const requests = JSON.stringify(api.mock.calls);
    expect(requests).not.toContain(f.priv.d);
    expect(requests).not.toContain('netCents');
    expect(requests).not.toContain(f.batch.documents[0].content);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('choosing the wrong .clair file gives a useful message and sends no content to the server', async () => {
  vi.clearAllMocks();
  render(<VatPage notify={vi.fn()} refresh={vi.fn()} onVerify={vi.fn()} />);
  await userEvent.click(screen.getByText('J’ai déjà un lot signé'));
  for (const text of ['not json', JSON.stringify({ kty: 'EC', d: 'private-test-value' })]) {
    const file = new File(['x'], 'wrong.clair');
    file.text = async () => text;
    await userEvent.upload(screen.getByLabelText('Lot de factures certifié'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/source de confiance/);
  }
  expect(api).not.toHaveBeenCalled();
  expect(launchProof).not.toHaveBeenCalled();
});
