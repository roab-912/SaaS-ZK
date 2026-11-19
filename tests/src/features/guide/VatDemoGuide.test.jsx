// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VatDemoGuide } from '../../../../src/features/guide/VatDemoGuide.jsx';
import { launchProof, compileForEngine } from '../../../../src/lib/zk-client.js';
import { download } from '../../../../src/lib/files.js';
import { ublFixture } from '../../../helpers/ubl.mjs';
import { webcrypto } from 'node:crypto';
vi.mock('../../../../src/lib/zk-client.js', () => ({
  launchProof: vi.fn(),
  compileForEngine: vi.fn(),
}));
vi.mock('../../../../src/lib/files.js', () => ({ download: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
test('all downloads and the generated proof use one demo session without registering its source', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const { batch, issuers } = await ublFixture(100);
  const session = {
    id: 'kit-Abc123',
    month: '2026-01',
    count: 100,
    netCents: 278340,
    expiresAt: '2099-01-01T00:00:00Z',
    source: issuers[0],
    januarySignature: batch.manifest.signature,
  };
  const fetcher = vi.fn(async (url) => ({
    ok: true,
    json: async () => (url.endsWith('session.json') ? session : batch),
  }));
  vi.stubGlobal('fetch', fetcher);
  const envelope = { proof: 'result' };
  launchProof.mockReturnValue({ promise: Promise.resolve(envelope), cancel: vi.fn() });
  compileForEngine.mockResolvedValue({});
  render(<VatDemoGuide />);
  await screen.findByRole('link', { name: 'Télécharger janvier.originaux.clair' });
  const links = screen.getAllByRole('link').filter((a) => a.hasAttribute('download'));
  expect(links.map((a) => a.download).sort()).toEqual([
    'fevrier.originaux.clair',
    'fevrier.preuve.clair',
    'janvier.originaux.clair',
    'janvier.preuve.clair',
    'verificateur.zip',
  ]);
  expect(links.every((a) => a.pathname.startsWith('/demo-tva/kit-Abc123/'))).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Générer ma preuve de janvier' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Télécharger ma preuve de janvier' }),
  );
  expect(launchProof.mock.calls[0][0]).toMatchObject({
    mode: 'prove',
    demoKit: session.id,
    circuit: { vat: { capacity: 100 } },
    vatBatch: batch,
    issuers,
  });
  expect(download).toHaveBeenCalledWith(envelope, 'ma-preuve-janvier.clair');
});
test('an expired kit keeps the guide readable and removes downloads', async () => {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ id: 'kit-Abc123', month: '2026-01', expiresAt: '2000-01-01T00:00:00Z' }),
  }));
  render(<VatDemoGuide />);
  expect(await screen.findByRole('alert')).toHaveTextContent('expiré');
  expect(screen.getAllByRole('link').filter((a) => a.hasAttribute('download'))).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Générer ma preuve de janvier' })).toBeDisabled();
});
