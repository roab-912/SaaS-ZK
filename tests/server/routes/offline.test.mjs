import { test, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { offlineFixture } from '../../helpers/offline.mjs';
import { serverFixture } from '../../helpers/server.mjs';
import { signedFixture } from '../../helpers/attestation.mjs';
test('anonymous offline download contains only the selected approved source and public software', async () => {
  const release = await offlineFixture(),
    f = await serverFixture({ offlineDirectory: release.dir });
  try {
    const signed = await signedFixture();
    for (const [id, approved] of [
      ['source-1', 1],
      ['other', 1],
      ['revoked', 0],
    ])
      f.db
        .prepare('INSERT INTO issuers(id,name,jwk,approved) VALUES(?,?,?,?)')
        .run(id, 'Source ' + id, JSON.stringify(signed.keys.publicKey), approved);
    expect((await (await f.request('/offline-verifier/status')).json()).available).toBe(true);
    const response = await f.request('/offline-verifier?issuer=source-1');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/zip');
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual(
      ['LIRE-MOI.txt', 'demarrer.cmd', 'logiciel.sha256', 'logiciel.zip', 'sources.clair'].sort(),
    );
    const snapshot = JSON.parse(strFromU8(archive['sources.clair']));
    expect(snapshot.issuers.map((i) => i.id)).toEqual(['source-1']);
    expect(snapshot.issuers[0].jwk).toEqual(signed.keys.publicKey);
    expect(strFromU8(archive['logiciel.zip'])).toBe('fake public software archive');
    const all = unzipSync(
      new Uint8Array(await (await f.request('/offline-verifier')).arrayBuffer()),
    );
    expect(
      JSON.parse(strFromU8(all['sources.clair']))
        .issuers.map((i) => i.id)
        .sort(),
    ).toEqual(['other', 'source-1'].sort());
    expect((await f.request('/offline-verifier?issuer=revoked')).status).toBe(404);
    expect((await f.request('/offline-verifier?issuer=../secret')).status).toBe(400);
  } finally {
    await f.close();
    await release.close();
  }
});
test('download is explicitly unavailable before the distributable is built', async () => {
  const release = await offlineFixture(),
    f = await serverFixture({ offlineDirectory: release.dir + '/missing' });
  try {
    expect((await f.request('/offline-verifier')).status).toBe(503);
    expect((await (await f.request('/offline-verifier/status')).json()).available).toBe(false);
  } finally {
    await f.close();
    await release.close();
  }
});
