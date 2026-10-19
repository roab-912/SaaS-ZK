// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { webcrypto, generateKeyPairSync } from 'node:crypto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueAttestation } from '../../../../src/features/issuers/IssueAttestation.jsx';
import { api } from '../../../../src/lib/api.js';
import { download } from '../../../../src/lib/files.js';
import { verifySignature } from '../../../../shared/attestations.mjs';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
test.each([
  ['number', '3000', 3000],
  ['date', '2000-02-29', '2000-02-29'],
  ['boolean', 'false', false],
])(
  'emits a %s attestation with no proof or private-key transmission',
  async (type, rawValue, value) => {
    vi.stubGlobal('crypto', webcrypto);
    vi.clearAllMocks();
    try {
      const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
        pub = pair.publicKey.export({ format: 'jwk' }),
        priv = pair.privateKey.export({ format: 'jwk' });
      api.mockResolvedValue([{ id: 'source-1', name: 'Émetteur de test', jwk: pub }]);
      const onBack = vi.fn();
      render(<IssueAttestation onBack={onBack} />);
      await screen.findByLabelText('Source émettrice');
      fireEvent.change(screen.getByLabelText('Nom du champ signé'), {
        target: { value: 'test_claim' },
      });
      await userEvent.selectOptions(screen.getByLabelText('Type de donnée'), type);
      const field = screen.getByLabelText('Valeur à attester');
      if (type === 'boolean') await userEvent.selectOptions(field, rawValue);
      else fireEvent.change(field, { target: { value: rawValue } });
      const key = screen.getByLabelText('Clé privée pour la donnée', { exact: true });
      fireEvent.change(key, { target: { value: JSON.stringify(priv) } });
      await userEvent.click(screen.getByRole('button', { name: 'Signer la donnée', exact: true }));
      expect(await screen.findByText('Attestation prête', { exact: true })).toBeVisible();
      expect(key).toHaveValue('');
      await userEvent.click(screen.getByRole('button', { name: 'Télécharger l’attestation' }));
      const a = download.mock.lastCall[0];
      expect(a).toMatchObject({
        format: 'clair-attestation/1',
        issuerId: 'source-1',
        claim: 'test_claim',
        type,
        value,
      });
      expect(await verifySignature(a)).toBe(true);
      expect(a.proof).toBeUndefined();
      expect(a.circuit).toBeUndefined();
      expect(JSON.stringify(a)).not.toContain(priv.d);
      expect(api.mock.calls.map((call) => call[0])).toEqual(['/issuers']);
      expect(JSON.stringify(api.mock.calls)).not.toContain(priv.d);
      await userEvent.click(screen.getByRole('button', { name: 'Retour aux sources' }));
      expect(onBack).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
test('no attestation can be emitted without an available source', async () => {
  api.mockResolvedValue([]);
  render(<IssueAttestation />);
  expect(await screen.findByText(/Aucune source approuvée disponible/)).toBeVisible();
  expect(screen.queryByLabelText(/Clé privée/)).toBeNull();
});
