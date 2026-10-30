// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ublImport from '../../../../src/features/vat/ubl-import.js';
import { ublFixture } from '../../../helpers/ubl.mjs';
import { verifyVatDocuments } from '../../../../shared/vat-documents.mjs';
import { VatAuthority } from '../../../../src/features/vat/VatAuthority.jsx';
import { api } from '../../../../src/lib/api.js';
import { download } from '../../../../src/lib/files.js';
import { launchProof } from '../../../../src/lib/zk-client.js';
import { verifyVatManifest } from '../../../../shared/vat.mjs';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
vi.mock('../../../../src/lib/zk-client.js', () => ({ launchProof: vi.fn() }));
test('a delayed private-key import cannot repopulate the key after a signing attempt', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await ublFixture();
    api.mockResolvedValue(f.issuers);
    render(<VatAuthority onBack={vi.fn()} />);
    await screen.findByRole('option', { name: 'Autorité TVA test' });
    vi.spyOn(ublImport, 'importUblFiles').mockResolvedValue(f.imported);
    fireEvent.change(screen.getByLabelText('Importer des factures UBL'), {
      target: { files: [new File(['xml'], 'facture.xml')] },
    });
    await screen.findByText('2 documents UBL validés localement');
    await userEvent.click(screen.getByRole('checkbox'));
    let finish;
    const file = new File(['x'], 'private.clair');
    file.text = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    await userEvent.upload(screen.getByLabelText('Importer la clé privée TVA'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Signer le relevé complet' }));
    await screen.findByRole('alert');
    await act(async () => finish(JSON.stringify(f.priv)));
    expect(screen.getByLabelText('Clé privée de l’émetteur TVA')).toHaveValue('');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('UBL authority signs both normalized values and exact original documents and clears its key', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const f = await ublFixture();
    api.mockResolvedValue(f.issuers);
    const importer = vi.spyOn(ublImport, 'importUblFiles').mockResolvedValue(f.imported);
    launchProof.mockReturnValue({
      promise: Promise.resolve({
        commitment: f.manifest.commitment,
        companyHash: f.manifest.companyHash,
        blinding: f.batch.blinding,
      }),
      cancel: vi.fn(),
    });
    render(<VatAuthority onBack={vi.fn()} />);
    await screen.findByRole('option', { name: 'Autorité TVA test' });
    fireEvent.change(screen.getByLabelText('Importer des factures UBL'), {
      target: { files: [new File(['xml'], 'facture.xml')] },
    });
    await screen.findByText('2 documents UBL validés localement');
    expect(importer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signer le relevé complet' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Clé privée de l’émetteur TVA'), {
      target: { value: JSON.stringify(f.priv) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Signer le relevé complet' }));
    await screen.findByRole('heading', { name: 'Lot certifié prêt' });
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger le lot certifié' }));
    const batch = download.mock.lastCall[0];
    expect(batch.format).toBe('clair-vat-batch/2');
    expect(batch.documents).toEqual(f.imported.documents);
    expect(batch.manifest.documentsRoot).toBe(f.manifest.documentsRoot);
    await expect(verifyVatDocuments(batch)).resolves.toBeUndefined();
    expect((await verifyVatManifest(batch.manifest, f.issuers)).valid).toBe(true);
    expect(screen.getByLabelText('Clé privée de l’émetteur TVA')).toHaveValue('');
    expect(JSON.stringify(launchProof.mock.calls)).not.toContain('<?xml');
    expect(api.mock.calls.map((c) => c[0])).toEqual(['/issuers']);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('the authority imports invoices only as UBL XML and keeps .clair for its private key and signed lot', async () => {
  const importer = vi.spyOn(ublImport, 'importUblFiles');
  api.mockResolvedValue([]);
  render(<VatAuthority onBack={vi.fn()} />);
  const input = screen.getByLabelText('Importer des factures UBL');
  expect(input).toHaveAttribute('multiple');
  expect(input.accept).toContain('.xml');
  expect(screen.queryByLabelText('Importer les données de facturation')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Préparer un exemple' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Télécharger les données à adapter' })).toBeNull();
  await userEvent.upload(input, new File(['{}'], 'factures.clair', { type: 'application/json' }));
  expect(importer).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Importer la clé privée TVA')).toHaveAttribute('accept', '.clair');
});
