import { test, expect, vi } from 'vitest';
import { get } from 'node:http';
import { startOffline } from '../../offline/server.mjs';
import { createTrustSnapshot } from '../../shared/trust-snapshot.mjs';
import { offlineFixture } from '../helpers/offline.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
test('local verifier rejects hostile origins, hosts and tokens and exposes no external API', async () => {
  const files = await offlineFixture();
  let app;
  try {
    const snapshot = await createTrustSnapshot([], 'https://clair.example');
    const trustPath = join(files.dir, 'sources.clair');
    await writeFile(trustPath, JSON.stringify(snapshot));
    const verify = vi.fn(async () => ({ valid: true, result: false }));
    app = await startOffline({ trustPath, verify });
    const html = await (await fetch(app.address)).text();
    const token = /name="clair-token"\s+content="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(token).toHaveLength(64);
    const post = (headers, body = '{}') =>
      fetch(app.address + '/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Clair-Local-Token': token, ...headers },
        body,
      });
    expect((await post({ 'X-Clair-Local-Token': 'é'.repeat(64) })).status).toBe(403);
    expect((await post({ Origin: 'https://evil.example' })).status).toBe(403);
    const hostStatus = await new Promise((resolve, reject) => {
      get(app.address, { headers: { Host: 'evil.example' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }).on('error', reject);
    });
    expect(hostStatus).toBe(403);
    expect((await post({}, 'invalid')).status).toBe(400);
    expect((await (await post({})).json()).result).toBe(false);
    expect(verify).toHaveBeenCalledTimes(1);
    expect((await fetch(app.address + '/.env')).status).toBe(404);
    expect((await fetch(app.address + '/api/session')).status).toBe(404);
    expect((await (await fetch(app.address + '/snapshot')).json()).format).toBe('clair-trust/1');
  } finally {
    await app?.close();
    await files.close();
  }
});

test('verification child starts with a valid Windows-compatible module URL and returns a controlled error', async () => {
  const { runVerification } = await import('../../offline/server.mjs');
  await expect(runVerification({}, {})).rejects.toThrow(/Vérification impossible/);
});
