// @vitest-environment jsdom
import React from 'react';
import { webcrypto } from 'node:crypto';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync, strFromU8 } from 'fflate';
import { Issuers } from '../../../../src/features/issuers/IssuersPage.jsx';
import { api } from '../../../../src/lib/api.js';
import { downloadBytes } from '../../../../src/lib/files.js';
import { generateSourceKeys } from '../../../../src/features/issuers/source-keys.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/lib/files.js', () => ({ downloadBytes: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  api.mockReset();
  api.mockResolvedValue([]);
  downloadBytes.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const admin = { admin: true };
test('an unavailable registry is not presented as empty and can be retried', async () => {
  api.mockImplementation(async (path) => {
    if (path === '/issuers') throw Error('Connexion interrompue.');
    return { available: false };
  });
  render(<Issuers user={null} notify={vi.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Chargement des autorités');
  expect(screen.queryByText('Aucune source disponible')).toBeNull();
  expect(await screen.findByRole('alert')).toHaveTextContent('Connexion interrompue');
  expect(screen.queryByText('Aucune source disponible')).toBeNull();
  api.mockResolvedValue([]);
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  expect(await screen.findByText('Aucune source disponible')).toBeVisible();
});

async function openKeyOptions() {
  await userEvent.click(screen.getByText('Clé publique et import d’une clé existante'));
}
async function sourceFixture() {
  const { publicKey } = await generateSourceKeys();
  let sources = [{ id: 'source-1', name: 'Source de test', jwk: publicKey, approved: true }];
  api.mockImplementation(async (path, body) => {
    if (body) {
      sources = sources.map((row) => (row.id === body.id ? body : row));
      return { ok: true };
    }
    if (path === '/admin/issuers') return sources;
    if (path === '/issuers') return sources.filter((row) => row.approved);
    return { available: true, bytes: 100 * 1048576 };
  });
  return publicKey;
}

test('only admins see creation and editing; public users see the approved registry', async () => {
  const onCreateAttestation = vi.fn();
  const view = render(
    <Issuers user={null} notify={vi.fn()} onCreateAttestation={onCreateAttestation} />,
  );
  expect(await screen.findByText('Aucune source disponible')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Ajouter une autorité' })).toBeNull();
  expect(screen.getByRole('article', { name: 'FranceConnect — à venir' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Créer une attestation' }));
  expect(onCreateAttestation).toHaveBeenCalledOnce();
  expect(api).toHaveBeenCalledWith('/issuers');
  view.rerender(<Issuers user={admin} notify={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Ajouter une autorité' })).toBeVisible();
  await waitFor(() => expect(api).toHaveBeenCalledWith('/admin/issuers'));
  expect(screen.getByLabelText('Clé publique P-256 (JWK)')).not.toBeVisible();
});

test('one compact button downloads both keys and normalizes accented identifiers before saving', async () => {
  render(<Issuers user={admin} notify={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Identifiant'), 'Source Démo');
  await userEvent.type(screen.getByLabelText('Nom'), 'Source de démonstration');
  expect(screen.getByLabelText('Identifiant')).toHaveValue('source-demo');
  expect(() => new RegExp(screen.getByLabelText('Identifiant').pattern, 'v')).not.toThrow();
  expect(screen.getByRole('button', { name: 'Enregistrer la source' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Générer les clés' }));
  await waitFor(() => expect(downloadBytes).toHaveBeenCalledOnce());
  const [bytes, filename, type] = downloadBytes.mock.lastCall;
  expect(filename).toBe('source-demo.cles.zip');
  expect(type).toBe('application/zip');
  const files = unzipSync(bytes);
  const privateKey = JSON.parse(strFromU8(files['source-demo.cle-privee.clair']));
  const publicKey = JSON.parse(strFromU8(files['source-demo.cle-publique.clair']));
  expect(privateKey.d).toHaveLength(43);
  expect(publicKey).not.toHaveProperty('d');
  expect(document.body.innerHTML).not.toContain(privateKey.d);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la source' }));
  expect(api).toHaveBeenCalledWith('/issuers', {
    id: 'source-demo',
    name: 'Source de démonstration',
    jwk: publicKey,
    approved: true,
  });
  expect(JSON.stringify(api.mock.calls)).not.toContain(privateKey.d);
});

test('failed archive downloads leave saving disabled and allow generation to be retried', async () => {
  downloadBytes.mockImplementationOnce(() => {
    throw Error('Téléchargement indisponible');
  });
  render(<Issuers user={admin} notify={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Générer les clés' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Téléchargement indisponible');
  expect(screen.getByLabelText('Clé publique P-256 (JWK)')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Enregistrer la source' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Générer les clés' }));
  await waitFor(() => expect(downloadBytes).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Enregistrer la source' })).toBeEnabled();
});

test('public key import accepts existing keys and rejects private or oversized files locally', async () => {
  const { publicKey, privateKey } = await generateSourceKeys();
  render(<Issuers user={admin} notify={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Identifiant'), 'imported');
  await userEvent.type(screen.getByLabelText('Nom'), 'Imported');
  await openKeyOptions();
  const upload = screen.getByLabelText('Importer une clé publique existante (.clair ou .json)');
  async function importText(text) {
    const file = new File([text], 'key.clair', { type: 'application/json' });
    file.text = async () => text;
    await userEvent.upload(upload, file);
    await waitFor(() => expect(upload).toBeEnabled());
  }
  await importText(JSON.stringify(privateKey));
  expect(await screen.findByRole('alert')).toHaveTextContent('sans clé privée');
  await importText(' '.repeat(4097));
  expect(await screen.findByRole('alert')).toHaveTextContent('4 Ko maximum');
  await importText(JSON.stringify(publicKey));
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la source' }));
  expect(api).toHaveBeenCalledWith('/issuers', expect.objectContaining({ jwk: publicKey }));
  expect(JSON.stringify(api.mock.calls)).not.toContain(privateKey.d);
});

test('the authority table edits names, confirms revocation and keeps revoked sources available for reactivation', async () => {
  await sourceFixture();
  render(<Issuers user={admin} notify={vi.fn()} />);
  await screen.findByRole('button', { name: 'Modifier' });
  expect(screen.getByRole('columnheader', { name: 'Statut' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  fireEvent.change(screen.getByLabelText('Nom de source-1'), { target: { value: 'Renamed' } });
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  expect(await screen.findByText('Renamed', { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  await userEvent.selectOptions(screen.getByLabelText('Statut de source-1'), 'false');
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Révoquer cette source ?' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Révoquer la source' }));
  expect(await screen.findByText('Révoquée', { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  expect(screen.getByLabelText('Statut de source-1')).toHaveValue('false');
  await userEvent.selectOptions(screen.getByLabelText('Statut de source-1'), 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  expect(await screen.findByText('Approuvée', { exact: true })).toBeVisible();
});

test('replacing a table public key requires confirmation, and cancel leaves the registry unchanged', async () => {
  const publicKey = await sourceFixture();
  const replacement = await generateSourceKeys();
  render(<Issuers user={admin} notify={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
  fireEvent.change(screen.getByLabelText('Clé publique de source-1'), {
    target: { value: JSON.stringify(replacement.publicKey) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Remplacer la clé de cette source ?' });
  expect(api.mock.calls.filter((call) => call[1])).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
  expect(api.mock.calls.filter((call) => call[1])).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remplacer la clé', exact: true }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/issuers',
      expect.objectContaining({ jwk: replacement.publicKey }),
    ),
  );
  expect(publicKey).not.toEqual(replacement.publicKey);
});

test('offline downloads and local table search remain available', async () => {
  await sourceFixture();
  render(<Issuers user={admin} notify={vi.fn()} />);
  expect(
    await screen.findByRole('link', { name: 'Télécharger le vérificateur hors ligne' }),
  ).toHaveAttribute('href', '/api/offline-verifier');
  expect(
    await screen.findByRole('link', { name: 'Télécharger le vérificateur pour Source de test' }),
  ).toHaveAttribute('href', '/api/offline-verifier?issuer=source-1');
  await userEvent.type(screen.getByRole('searchbox'), 'missing');
  expect(screen.getByText('Aucune source ne correspond à cette recherche.')).toBeVisible();
});

test('late imports are discarded after leaving the page', async () => {
  const { publicKey } = await generateSourceKeys();
  const view = render(<Issuers user={admin} notify={vi.fn()} />);
  await openKeyOptions();
  let finish;
  const file = new File(['x'], 'key.clair');
  file.text = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  await userEvent.upload(
    screen.getByLabelText('Importer une clé publique existante (.clair ou .json)'),
    file,
  );
  view.unmount();
  await act(async () => finish(JSON.stringify(publicKey)));
  expect(api.mock.calls.filter((call) => call[1])).toHaveLength(0);
});
