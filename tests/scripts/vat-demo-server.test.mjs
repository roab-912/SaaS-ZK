import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { prepareVatDemo } from '../../scripts/vat-demo-fixtures.mjs';
import { startVatDemo } from '../../scripts/vat-demo-server.mjs';
test('demo server uses only memory, has an approved fictional issuer and keeps approval restricted to its admin', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clair-vat-demo-test-'));
  let runtime;
  try {
    const fixture = await prepareVatDemo(root, [10]);
    runtime = await startVatDemo({ directory: fixture.directory, port: 0 });
    expect(runtime.config.dbPath).toBe(':memory:');
    expect(runtime.config.stripeKey).toBe('');
    expect(runtime.config.mode).toBe('demo');
    const source = await (await fetch(runtime.url + '/api/issuers')).json();
    expect(source).toHaveLength(1);
    expect(source[0].jwk.d).toBeUndefined();
    const login = await fetch(runtime.url + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: runtime.config.appUrl },
      body: JSON.stringify(fixture.config.credentials.user),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const session = await (
      await fetch(runtime.url + '/api/session', { headers: { Cookie: cookie } })
    ).json();
    expect(session.user.active).toBe(true);
    expect(session.user.admin).toBe(false);
    const change = await fetch(runtime.url + '/api/issuers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: runtime.config.appUrl,
        Cookie: cookie,
      },
      body: JSON.stringify({ ...source[0], approved: false }),
    });
    expect(change.status).toBe(403);
  } finally {
    await runtime?.close();
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + sep) ||
      !basename(root).startsWith('clair-vat-demo-test-')
    )
      expect.fail('Nettoyage hors dossier temporaire');
    await rm(root, { recursive: true, force: true });
  }
});
