// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { waitFor, fireEvent } from '@testing-library/react';
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
