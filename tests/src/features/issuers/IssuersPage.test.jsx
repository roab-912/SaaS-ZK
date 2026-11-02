// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Issuers } from '../../../../src/features/issuers/IssuersPage.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn(async () => []) }));
test('sources page only lists available sources and gates the addition form by admin role', async () => {
  const props = { user: { admin: false }, notify: vi.fn(), onCreateAttestation: vi.fn() },
    view = render(<Issuers {...props} />);
  expect(await screen.findByText('Aucune source disponible')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Ajouter ou modifier une source' })).toBeNull();
  expect(screen.getByRole('article', { name: 'FranceConnect — à venir' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Créer une attestation' }));
  expect(props.onCreateAttestation).toHaveBeenCalledOnce();
  expect(screen.queryByText(/Atelier/)).toBeNull();
  expect(screen.queryByLabelText(/Clé privée/)).toBeNull();
  view.rerender(<Issuers {...props} user={{ admin: true }} />);
  expect(screen.getByRole('heading', { name: 'Ajouter ou modifier une source' })).toBeVisible();
  expect(screen.getByLabelText('Clé publique P-256 (JWK)')).toBeVisible();
  expect(api).toHaveBeenCalledWith('/issuers');
});

test('available sources offer Windows offline downloads for all sources or one selected source', async () => {
  const { signedFixture } = await import('../../../helpers/attestation.mjs');
  const { issuers } = await signedFixture();
  api.mockImplementation(async (path) =>
    path === '/issuers'
      ? issuers
      : { available: true, bytes: 100 * 1048576, platform: 'win32-x64' },
  );
  render(<Issuers user={null} notify={vi.fn()} />);
  const all = await screen.findByRole('link', { name: 'Télécharger le vérificateur hors ligne' });
  expect(all).toHaveAttribute('href', '/api/offline-verifier');
  expect(
    await screen.findByRole('link', { name: 'Télécharger le vérificateur pour Source de test' }),
  ).toHaveAttribute('href', '/api/offline-verifier?issuer=source-1');
  expect(screen.getByText(/révocations et changements de clés ultérieurs/)).toBeVisible();
});

test('source search stays local and replacing a public key requires confirmation', async () => {
  const { signedFixture } = await import('../../../helpers/attestation.mjs');
  const { generateSigningKey } = await import('../../../../shared/attestations.mjs');
  const { issuers } = await signedFixture(),
    replacement = await generateSigningKey();
  api.mockClear();
  api.mockImplementation(async (path) => (path === '/issuers' ? issuers : { available: false }));
  render(<Issuers user={{ admin: true }} notify={vi.fn()} />);
  await screen.findByRole('button', { name: 'Modifier' });
  await userEvent.type(screen.getByRole('searchbox'), 'SOURCE test');
  expect(screen.getByText('1 résultat', { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  await userEvent.clear(screen.getByLabelText('Clé publique P-256 (JWK)'));
  fireEvent.change(screen.getByLabelText('Clé publique P-256 (JWK)'), {
    target: { value: JSON.stringify(replacement.publicKey) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la source' }));
  expect(api.mock.calls.filter((c) => c[1])).toHaveLength(0);
  await screen.findByRole('dialog', { name: 'Remplacer la clé de cette source ?' });
  await userEvent.click(screen.getByRole('button', { name: 'Annuler', exact: true }));
  expect(api.mock.calls.filter((c) => c[1])).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la source' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remplacer la clé', exact: true }),
  );
  expect(api).toHaveBeenCalledWith(
    '/issuers',
    expect.objectContaining({ jwk: replacement.publicKey }),
  );
});
test('a pasted private key is rejected locally and never sent to the source registry', async () => {
  const { generateSigningKey } = await import('../../../../shared/attestations.mjs'),
    keys = await generateSigningKey();
  api.mockClear();
  api.mockResolvedValue([]);
  render(<Issuers user={{ admin: true }} notify={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Identifiant'), 'issuer');
  await userEvent.type(screen.getByLabelText('Nom'), 'Source');
  // fireEvent avoids interpreting JSON braces as keyboard shortcuts.
  fireEvent.change(screen.getByLabelText('Clé publique P-256 (JWK)'), {
    target: { value: JSON.stringify(keys.privateKey) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la source' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('sans clé privée');
  expect(api.mock.calls.filter((c) => c[1])).toHaveLength(0);
});
