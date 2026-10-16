import { createApp } from '../../server/app.mjs';
export async function serverFixture(options = {}) {
  const instance = createApp({
    dbPath: ':memory:',
    appUrl: 'http://localhost:3000',
    env: { BILLING_MODE: 'demo' },
    ...options,
  });
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  async function request(
    path,
    { body, cookie, origin = 'http://localhost:3000', method, headers = {} } = {},
  ) {
    return fetch(url + '/api' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  }
  async function account(email = 'alice@example.test') {
    const response = await request('/auth/register', {
      body: { email, password: 'long-password-123' },
    });
    if (response.status !== 201) throw Error('Registration failed: ' + (await response.text()));
    return {
      cookie: response.headers.get('set-cookie').split(';')[0],
      user: (await response.json()).user,
    };
  }
  return {
    ...instance,
    request,
    account,
    async close() {
      await new Promise((r) => server.close(r));
      instance.db.close();
    },
  };
}
