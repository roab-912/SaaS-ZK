import { test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { serverFixture } from '../../helpers/server.mjs';
test('only approved account IDs can add and revoke validated public keys', async () => {
  const f = await serverFixture({ env: { BILLING_MODE: 'demo', ADMIN_USER_IDS: 'admin' } });
  try {
    const a = await f.account();
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const body = {
      id: 'issuer',
      name: 'Issuer',
      jwk: publicKey.export({ format: 'jwk' }),
      approved: true,
    };
    expect((await f.request('/issuers', { cookie: a.cookie, body })).status).toBe(403);
    // Set a known ID without changing the role model or relying on email.
    f.db
      .prepare('INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)')
      .run(
        'admin',
        'admin@example.test',
        f.db.prepare('SELECT password FROM users WHERE id=?').get(a.user.id).password,
        'now',
      );
    const login = await f.request('/auth/login', {
        body: { email: 'admin@example.test', password: 'long-password-123' },
      }),
      cookie = login.headers.get('set-cookie').split(';')[0];
    expect((await f.request('/issuers', { cookie, body })).status).toBe(200);
    expect(await (await f.request('/issuers')).json()).toHaveLength(1);
    await f.request('/issuers', { cookie, body: { ...body, approved: false } });
    expect(await (await f.request('/issuers')).json()).toEqual([]);
  } finally {
    await f.close();
  }
});

test('approved registry keys bind public attestations and revocation removes trust', async () => {
  const { signedFixture } = await import('../../helpers/attestation.mjs');
  const { verifyEvidence } = await import('../../../shared/attestations.mjs');
  const { buildProofEnvelope, contextField } = await import('../../../shared/proof.mjs');
  const { circuitHash } = await import('../../../shared/circuit.mjs');
  const { ENGINE } = await import('../../../shared/engines.mjs');
  const f = await serverFixture({ env: { BILLING_MODE: 'demo', ADMIN_USER_IDS: 'admin' } });
  try {
    const a = await f.account(),
      signed = await signedFixture();
    f.db
      .prepare('INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)')
      .run(
        'admin',
        'admin@example.test',
        f.db.prepare('SELECT password FROM users WHERE id=?').get(a.user.id).password,
        'now',
      );
    const login = await f.request('/auth/login', {
      body: { email: 'admin@example.test', password: 'long-password-123' },
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const source = { ...signed.issuers[0], approved: true };
    expect((await f.request('/issuers', { cookie, body: source })).status).toBe(200);
    const list = () => f.request('/issuers').then((r) => r.json());
    expect(
      (await verifyEvidence(signed.circuit, signed.values, signed.attestations, await list()))[0]
        .valid,
    ).toBe(true);
    f.activate(cookie);
    expect((await f.request('/circuits', { cookie, body: signed.circuit })).status).toBe(201);
    const hash = await circuitHash(signed.circuit),
      envelope = buildProofEnvelope({
        engine: ENGINE,
        circuit: signed.circuit,
        circuitHash: hash,
        publicInputs: [contextField(hash), '0x1', '0xbb8'],
        proof: 'AAAA',
        attestations: signed.attestations,
      });
    expect((await f.request('/proofs', { cookie, body: envelope })).status).toBe(201);
    const stored = await (await f.request('/proofs', { cookie })).json();
    expect(stored[0].envelope).toEqual(envelope);
    expect(
      (await f.request('/issuers', { cookie: a.cookie, body: { ...source, approved: false } }))
        .status,
    ).toBe(403);
    expect(
      (await f.request('/issuers', { cookie, body: { ...source, approved: false } })).status,
    ).toBe(200);
    expect(
      (await verifyEvidence(signed.circuit, signed.values, signed.attestations, await list()))[0],
    ).toMatchObject({ valid: false, approved: false, signatureValid: true });
  } finally {
    await f.close();
  }
});
