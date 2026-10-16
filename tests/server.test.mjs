import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { template, circuitHash, contextField, ENGINE } from '../shared/circuit.mjs';

test('accounts, paid access, isolation, expiry and CSRF', async () => {
  const { app, db } = createApp({ dbPath: ':memory:', appUrl: 'http://localhost:3000' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  async function call(path, { body, cookie, origin = 'http://localhost:3000', method } = {}) {
    return fetch(url + '/api' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    assert.equal((await call('/circuits', { body: template() })).status, 401);
    let r = await call('/auth/register', {
      body: { email: 'alice@example.test', password: 'long-password-123' },
    });
    assert.equal(r.status, 201);
    const cookie = r.headers.get('set-cookie').split(';')[0],
      user = (await r.json()).user;
    assert.ok(r.headers.get('set-cookie').includes('HttpOnly'));
    assert.ok(r.headers.get('set-cookie').includes('SameSite=Strict'));
    assert.equal((await call('/circuits', { body: template(), cookie })).status, 402);
    assert.equal((await call('/prover/authorize', { body: {}, cookie })).status, 402);
    assert.equal(
      (
        await call('/billing/demo', {
          body: { action: 'activate' },
          cookie,
          origin: 'https://evil.test',
        })
      ).status,
      403,
    );
    assert.equal(
      (await call('/billing/demo', { body: { action: 'activate' }, cookie })).status,
      200,
    );
    assert.equal((await call('/prover/authorize', { body: {}, cookie })).status, 200);
    r = await call('/circuits', { body: template(), cookie });
    assert.equal(r.status, 201);
    const record = await r.json();
    r = await call('/auth/register', {
      body: { email: 'bob@example.test', password: 'long-password-123' },
    });
    const bob = r.headers.get('set-cookie').split(';')[0];
    assert.deepEqual(await (await call('/circuits', { cookie: bob })).json(), []);
    await call('/circuits/' + record.id, { body: {}, cookie: bob, method: 'DELETE' });
    assert.equal((await (await call('/circuits', { cookie })).json()).length, 1);
    assert.equal((await call('/issuers', { body: {}, cookie })).status, 403);
    const c = template(),
      hash = await circuitHash(c);
    const envelope = {
      format: 'clair-proof/1',
      engine: ENGINE,
      circuit: c,
      circuitHash: hash,
      publicInputs: [contextField(hash), '0x1326919'],
      proof: 'AAAA',
    };
    assert.equal(
      (await call('/proofs', { body: { ...envelope, privateInputs: { secret: 123 } }, cookie }))
        .status,
      400,
    );
    assert.equal((await call('/proofs', { body: envelope, cookie })).status, 201);
    assert.deepEqual(await (await call('/proofs', { cookie: bob })).json(), []);
    db.prepare('UPDATE users SET expires=? WHERE id=?').run(Date.now() - 1000, user.id);
    assert.equal((await call('/circuits', { body: template('income'), cookie })).status, 402);
    assert.equal((await call('/proofs', { body: envelope, cookie })).status, 402);
    assert.equal((await call('/circuits', { cookie })).status, 200);
    assert.equal((await call('/compile', { body: template('list') })).status, 200);
    assert.equal((await call('/auth/logout', { body: {}, cookie })).status, 200);
    assert.equal((await call('/circuits', { cookie })).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
test('demo cannot be enabled in production or on a public origin', () => {
  assert.throws(() => createApp({ dbPath: ':memory:', production: true }), /demo/);
  assert.throws(() => createApp({ dbPath: ':memory:', appUrl: 'https://example.com' }), /demo/);
});
