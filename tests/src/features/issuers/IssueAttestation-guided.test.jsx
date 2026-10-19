// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { webcrypto, generateKeyPairSync } from 'node:crypto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueAttestation } from '../../../../src/features/issuers/IssueAttestation.jsx';
import { api } from '../../../../src/lib/api.js';
import { download } from '../../../../src/lib/files.js';
import { keyFingerprint, verifySignature } from '../../../../shared/attestations.mjs';
import { template } from '../../../../shared/circuit.mjs';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
async function fixture() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
    jwk = pair.publicKey.export({ format: 'jwk' }),
    privateKey = pair.privateKey.export({ format: 'jwk' });
  const source = { id: 'source-1', name: 'Autorite', jwk, keyHash: await keyFingerprint(jwk) };
  const inputs = ['number', 'date', 'boolean'].map((type, index) => ({
    id: 'field_' + index,
    label: 'Champ ' + index,
    type,
    visibility: 'public',
    source: 'signed',
    attestation: { issuerId: source.id, keyHash: source.keyHash, claim: 'claim_' + index },
  }));
  inputs.push({
    id: 'secret',
    label: 'Secret',
    type: 'number',
    visibility: 'private',
    source: 'declared',
  });
  inputs.push({
    ...inputs[0],
    id: 'other',
    label: 'Autre autorite',
    attestation: { ...inputs[0].attestation, issuerId: 'other' },
  });
  const eq = (i) => ({
    kind: 'op',
    op: 'eq',
    args: [
      { kind: 'input', id: i.id },
      { kind: 'input', id: i.id },
    ],
  });
  const schema = {
    ...template('blank'),
    version: 2,
    name: 'Circuit guide',
    inputs,
    root: inputs.map(eq).reduce((a, b) => ({ kind: 'op', op: 'and', args: [a, b] })),
  };
  api.mockResolvedValue([source]);
  return { source, privateKey, schema, record: { id: 'saved', hash: 'a'.repeat(64), schema } };
}
test.each([false, true])(
  'one key signs expected typed fields (private attestation: %s)',
  async (privateInput) => {
    vi.stubGlobal('crypto', webcrypto);
    vi.clearAllMocks();
    try {
      const { record, privateKey, source } = await fixture();
      if (privateInput) {
        record.schema.inputs[0].visibility = 'private';
        record.schema.inputs[0].attestation.publicKey = source.jwk;
      }
      render(<IssueAttestation circuits={[record]} />);
      await screen.findByLabelText('Source émettrice');
      await userEvent.selectOptions(screen.getByLabelText('Circuit à utiliser'), record.hash);
      expect(screen.queryByLabelText('Nom du champ signé')).toBeNull();
      expect(screen.queryByLabelText(/Valeur pour Secret/)).toBeNull();
      expect(screen.queryByLabelText(/Valeur pour Autre/)).toBeNull();
      fireEvent.change(screen.getByLabelText('Valeur pour Champ 0 (field_0)'), {
        target: { value: '3000' },
      });
      fireEvent.change(screen.getByLabelText('Valeur pour Champ 1 (field_1)'), {
        target: { value: '2000-02-29' },
      });
      await userEvent.selectOptions(screen.getByLabelText('Valeur pour Champ 2 (field_2)'), 'true');
      const key = screen.getByLabelText('Clé privée pour les données du circuit', { exact: true });
      fireEvent.change(key, { target: { value: JSON.stringify(privateKey) } });
      await userEvent.click(
        screen.getByRole('button', { name: 'Signer les données du circuit', exact: true }),
      );
      expect(await screen.findByText('Attestations prêtes')).toBeVisible();
      expect(key).toHaveValue('');
      for (let i = 0; i < 3; i++) {
        await userEvent.click(screen.getByRole('button', { name: 'Télécharger Champ ' + i }));
        const a = download.mock.lastCall[0];
        expect(a).toMatchObject({
          format: privateInput && i === 0 ? 'clair-attestation/2' : 'clair-attestation/1',
          claim: 'claim_' + i,
          value: [3000, '2000-02-29', true][i],
        });
        expect(await verifySignature(a)).toBe(true);
        expect(JSON.stringify(a)).not.toContain(privateKey.d);
      }
      expect(api.mock.calls.map((c) => c[0])).toEqual(['/issuers']);
      fireEvent.change(screen.getByLabelText('Valeur pour Champ 0 (field_0)'), {
        target: { value: '4000' },
      });
      expect(screen.queryByText('Attestations prêtes')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
test('external issuer imports a circuit locally; missing values produce no partial attestations', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const { schema, privateKey } = await fixture();
    render(<IssueAttestation />);
    await screen.findByLabelText('Source émettrice');
    const file = new File([''], 'circuit.clair', { type: 'application/json' });
    file.text = async () => JSON.stringify(schema);
    expect(screen.getByLabelText('Importer un circuit public')).toHaveAttribute('accept', '.clair');
    await userEvent.upload(screen.getByLabelText('Importer un circuit public'), file);
    await screen.findByLabelText('Valeur pour Champ 0 (field_0)');
    fireEvent.change(
      screen.getByLabelText('Clé privée pour les données du circuit', { exact: true }),
      { target: { value: JSON.stringify(privateKey) } },
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Signer les données du circuit', exact: true }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/Champ [01]/);
    expect(screen.queryByText('Attestations prêtes')).toBeNull();
    expect(download).not.toHaveBeenCalled();
    expect(api.mock.calls.map((c) => c[0])).toEqual(['/issuers']);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('a replaced authority key cannot be used to sign an old circuit', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const { record } = await fixture();
    record.schema.inputs
      .filter((i) => i.source === 'signed')
      .forEach((i) => {
        i.attestation.keyHash = 'b'.repeat(64);
      });
    render(<IssueAttestation circuits={[record]} />);
    await screen.findByLabelText('Source émettrice');
    expect(screen.queryByRole('option', { name: /Circuit guide/ })).toBeNull();
    expect(screen.getByText(/Aucun circuit disponible ne désigne cette source/)).toBeVisible();
    expect(
      screen.queryByLabelText('Clé privée pour les données du circuit', { exact: true }),
    ).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

test('authority selection filters circuits and clears the previous authority values and key', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const { source, record } = await fixture();
    const other = { ...source, id: 'other', name: 'Autre source' };
    api.mockResolvedValue([source, other]);
    const unrelated = { id: 'unrelated', hash: 'c'.repeat(64), schema: template('blank') };
    const otherOnly = structuredClone(record);
    otherOnly.hash = 'd'.repeat(64);
    otherOnly.schema.name = 'Circuit autre source';
    otherOnly.schema.inputs
      .filter((i) => i.source === 'signed')
      .forEach((i) => {
        i.attestation.issuerId = 'other';
      });
    render(<IssueAttestation circuits={[record, unrelated, otherOnly]} />);
    await screen.findByLabelText('Source émettrice');
    expect(screen.getByRole('option', { name: /Circuit guide/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Circuit autre source/ })).toBeNull();
    expect(
      screen.queryByRole('option', {
        value: unrelated.hash,
        name: new RegExp(unrelated.schema.name),
      }),
    ).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Circuit à utiliser'), record.hash);
    fireEvent.change(screen.getByLabelText('Valeur pour Champ 0 (field_0)'), {
      target: { value: '3000' },
    });
    fireEvent.change(
      screen.getByLabelText('Clé privée pour les données du circuit', { exact: true }),
      { target: { value: 'private text' } },
    );
    await userEvent.selectOptions(screen.getByLabelText('Source émettrice'), 'other');
    expect(screen.getByLabelText('Circuit à utiliser')).toHaveValue('');
    expect(screen.queryByLabelText('Valeur pour Champ 0 (field_0)')).toBeNull();
    expect(screen.getByRole('option', { name: /Circuit autre source/ })).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText('Circuit à utiliser'), record.hash);
    expect(screen.getByLabelText('Valeur pour Autre autorite (other)')).toBeVisible();
    expect(screen.queryByLabelText('Valeur pour Champ 0 (field_0)')).toBeNull();
    expect(
      screen.getByLabelText('Clé privée pour les données du circuit', { exact: true }),
    ).toHaveValue('');
    await userEvent.selectOptions(screen.getByLabelText('Source émettrice'), source.id);
    expect(screen.queryByRole('option', { name: /Circuit autre source/ })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Circuit à utiliser'), record.hash);
    expect(screen.getByLabelText('Valeur pour Champ 0 (field_0)')).toHaveValue(null);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('importing a circuit for another authority is refused without changing the selected source', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.clearAllMocks();
  try {
    const { source, schema } = await fixture();
    schema.inputs
      .filter((i) => i.source === 'signed')
      .forEach((i) => {
        i.attestation.issuerId = 'other';
      });
    render(<IssueAttestation />);
    await screen.findByLabelText('Source émettrice');
    const file = new File([''], 'other.clair', { type: 'application/json' });
    file.text = async () => JSON.stringify(schema);
    await userEvent.upload(screen.getByLabelText('Importer un circuit public'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/ne désigne pas cette autorité/);
    expect(screen.getByLabelText('Source émettrice')).toHaveValue(source.id);
    expect(screen.queryByRole('option', { name: /Circuit guide/ })).toBeNull();
    expect(
      screen.queryByLabelText('Clé privée pour les données du circuit', { exact: true }),
    ).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
