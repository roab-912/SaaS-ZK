// @vitest-environment jsdom
import React from 'react';
import { webcrypto, generateKeyPairSync } from 'node:crypto';
import { test, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignField } from '../../../../src/features/proofs/SignField.jsx';
import { keyFingerprint, verifySignature } from '../../../../shared/attestations.mjs';
test('field signing uses the expected key locally, clears it, and only returns an attestation', async () => {
  vi.stubGlobal('crypto', webcrypto);
  try {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
      privateJwk = pair.privateKey.export({ format: 'jwk' }),
      publicJwk = pair.publicKey.export({ format: 'jwk' }),
      onSigned = vi.fn();
    const input = {
      id: 'income',
      label: 'Revenu',
      type: 'number',
      visibility: 'public',
      source: 'signed',
      attestation: {
        issuerId: 'source-1',
        keyHash: await keyFingerprint(publicJwk),
        claim: 'income_monthly_eur',
      },
    };
    render(<SignField input={input} value="3000" onSigned={onSigned} />);
    const field = screen.getByLabelText('Clé privée pour Revenu');
    const wrong = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
      format: 'jwk',
    });
    fireEvent.change(field, { target: { value: JSON.stringify(wrong) } });
    await userEvent.click(screen.getByRole('button', { name: 'Signer Revenu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ne correspond pas');
    expect(field).toHaveValue('');
    expect(onSigned).not.toHaveBeenCalled();
    const file = new File([JSON.stringify(privateJwk)], 'private.clair', {
      type: 'application/json',
    });
    file.text = async () => JSON.stringify(privateJwk);
    expect(screen.getByLabelText('Importer une clé privée pour Revenu')).toHaveAttribute(
      'accept',
      '.clair',
    );
    await userEvent.upload(screen.getByLabelText('Importer une clé privée pour Revenu'), file);
    await waitFor(() => expect(field).not.toHaveValue(''));
    await userEvent.click(screen.getByRole('button', { name: 'Signer Revenu' }));
    await waitFor(() => expect(onSigned).toHaveBeenCalledOnce());
    expect(field).toHaveValue('');
    const a = onSigned.mock.lastCall[0];
    expect(a.value).toBe(3000);
    expect(await verifySignature(a)).toBe(true);
    expect(JSON.stringify(a)).not.toContain(privateJwk.d);
  } finally {
    vi.unstubAllGlobals();
  }
});
