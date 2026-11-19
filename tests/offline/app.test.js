// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { waitFor, fireEvent } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { ublFixture } from '../helpers/ubl.mjs';
test('offline interface distinguishes valid proof from true result and safely renders untrusted names', async () => {
  document.documentElement.innerHTML = readFileSync('offline/index.html', 'utf8');
  const snapshot = {
    origin: 'https://clair.example',
    exportedAt: new Date().toISOString(),
    issuers: [{ id: 'source-1', name: '<img src=x>', keyHash: 'a'.repeat(64) }],
  };
  const fetcher = vi.fn(async (url) => ({
    ok: true,
    json: async () =>
      url === '/snapshot'
        ? snapshot
        : {
            valid: true,
            result: false,
            circuitName: '<img src=x>',
            statement: 'A >= B',
            circuitHash: 'a'.repeat(64),
            publicData: [{ id: 'cutoff', label: 'Date limite', type: 'date', value: '2008-09-21' }],
            sources: [],
            checkedAt: new Date().toISOString(),
          },
  }));
  vi.stubGlobal('fetch', fetcher);
  try {
    await import('../../offline/app.js');
    await waitFor(() =>
      expect(document.getElementById('snapshot').textContent).toContain('clair.example'),
    );
    expect(document.querySelector('#issuers img')).toBeNull();
    const field = document.getElementById('proof');
    expect(field.accept).toBe('.clair');
    const f = new File(['{}'], 'proof.clair');
    f.text = async () => JSON.stringify({ circuitHash: 'a'.repeat(64) });
    Object.defineProperty(field, 'files', { configurable: true, value: [f] });
    fireEvent.change(field);
    fireEvent.click(document.getElementById('verify'));
    await waitFor(() => expect(document.getElementById('result').hidden).toBe(false));
    expect(document.getElementById('condition').textContent).toContain('Faux');
    expect(document.getElementById('values').textContent).toContain('21/09/2008');
    expect(document.querySelector('#result img')).toBeNull();
    document.getElementById('expected').value = 'b'.repeat(64);
    fireEvent.click(document.getElementById('verify'));
    await waitFor(() =>
      expect(document.getElementById('status').textContent).toContain('ne correspond pas'),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('monthly request uses independent criteria and opens a browser-only audit after acceptance', async () => {
  vi.resetModules();
  vi.stubGlobal('crypto', webcrypto);
  try {
    document.documentElement.innerHTML = readFileSync('offline/index.html', 'utf8');
    const el = (id) => document.getElementById(id);
    const { batch, manifest } = await ublFixture();
    const issuer = { id: manifest.issuerId, name: 'Source TVA', keyHash: manifest.keyHash };
    const response = {
      valid: true,
      result: true,
      vatProgramVersion: 2,
      vatManifest: manifest,
      sources: [],
      publicData: [],
      checkedAt: manifest.issuedAt,
    };
    const fetcher = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url === '/snapshot'
          ? {
              origin: 'https://demo.invalid',
              exportedAt: manifest.issuedAt,
              issuers: [issuer, { ...issuer, id: 'autre' }],
            }
          : response,
    }));
    vi.stubGlobal('fetch', fetcher);
    await import('../../offline/app.js');
    await waitFor(() => expect(el('issuer').options.length).toBe(3));
    const upload = (id, data) =>
      fireEvent.change(el(id), {
        target: {
          files: [
            {
              size: 1500,
              text: async () => JSON.stringify(data),
            },
          ],
        },
      });
    const verify = async (expected) => {
      fireEvent.click(el('verify'));
      await waitFor(() => expect(el('status').textContent).toContain(expected));
    };
    fireEvent.change(el('mode'), { target: { value: 'vat' } });
    el('company').value = manifest.companyId;
    el('issuer').value = issuer.id;
    el('month').value = '2026-08';
    upload('proof', {});
    await verify('période différente');
    expect(el('audit').hidden).toBe(true);
    el('month').value = '2026-09';
    el('company').value = 'AUTRE';
    await verify('entreprise différente');
    el('company').value = manifest.companyId;
    el('issuer').value = 'autre';
    await verify('source différente');
    el('issuer').value = issuer.id;
    response.vatProgramVersion = 1;
    await verify('programme TVA v2');
    response.vatProgramVersion = 2;
    response.valid = false;
    await verify('Demande refusée');
    response.valid = true;
    await verify('Vérification terminée');
    expect(el('validity').textContent).toBe('Demande de TVA satisfaite');
    const calls = fetcher.mock.calls.length;
    upload('originals', batch);
    await waitFor(() =>
      expect(el('audit-status').textContent).toContain('2 originaux correspondent'),
    );
    fireEvent.change(el('document'), { target: { selectedIndex: 1 } });
    expect(el('invoice').textContent).toContain('Facture ' + batch.documents[0].originalId);
    expect(el('invoice').textContent).toContain('Client de démonstration');
    expect(el('invoice').textContent).toContain('Article de démonstration 2');
    expect(el('invoice').textContent).toMatch(/146,38\s€/);
    expect(el('xml-source').open).toBe(false);
    el('xml-source').open = true;
    expect(el('xml').textContent).toContain('<?xml');
    fireEvent.change(el('document'), { target: { selectedIndex: 2 } });
    expect(el('xml-source').open).toBe(false);
    expect(el('invoice').textContent).toContain('Avoir ' + batch.documents[1].originalId);
    expect(el('invoice').textContent).toContain(
      'Facture de référence · ' + batch.documents[0].originalId,
    );
    expect(fetcher).toHaveBeenCalledTimes(calls);
    fireEvent.input(el('month'), { target: { value: '2026-10' } });
    expect(el('result').hidden).toBe(true);
    expect(el('audit').hidden).toBe(true);
    expect(el('xml').textContent).toBe('');
    expect(el('invoice').textContent).toBe('');
  } finally {
    vi.unstubAllGlobals();
  }
});
