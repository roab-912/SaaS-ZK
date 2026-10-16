import { test } from 'vitest';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createApp } from '../server/app.mjs';
test('Stripe contract: signed webhooks, authoritative status, checkout reuse, cancellation', async () => {
  const vars = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'];
  const prior = Object.fromEntries(vars.map((k) => [k, process.env[k]]));
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_contract';
  process.env.STRIPE_PRICE_ID = 'price_local';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_contract';
  let subscriptions = [],
    created = 0;
  const real = new Stripe(process.env.STRIPE_SECRET_KEY);
  const fake = {
    webhooks: real.webhooks,
    subscriptions: { list: async () => ({ data: subscriptions }) },
    customers: { create: async () => ({ id: 'cus_local' }) },
    checkout: {
      sessions: {
        create: async () => {
          created++;
          return { id: 'cs_local', url: 'https://checkout.stripe.com/local', status: 'open' };
        },
        retrieve: async () => ({
          id: 'cs_local',
          url: 'https://checkout.stripe.com/local',
          status: 'open',
        }),
      },
    },
    billingPortal: {
      sessions: { create: async () => ({ url: 'https://billing.stripe.com/local' }) },
    },
  };
  const { app, db } = createApp({
    dbPath: ':memory:',
    mode: 'stripe',
    appUrl: 'http://localhost:3000',
    stripeClient: fake,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const root = 'http://127.0.0.1:' + server.address().port;
  let cookie;
  async function post(path, body, headers = {}) {
    return fetch(root + '/api' + path, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }
  const current = async () =>
    (await (await fetch(root + '/api/session', { headers: { Cookie: cookie } })).json()).user;
  try {
    const reg = await post('/auth/register', {
      email: 'billing@example.test',
      password: 'password-long-enough',
    });
    cookie = reg.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/billing/demo', { action: 'activate' })).status, 404);
    assert.equal((await post('/billing/checkout', {})).status, 200);
    assert.equal((await post('/billing/checkout', {})).status, 200);
    assert.equal(created, 1);
    assert.equal((await current()).active, false);
    const event = JSON.stringify({
      id: 'evt_local',
      object: 'event',
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_local' } },
    });
    assert.equal(
      (await post('/billing/webhook', event, { 'stripe-signature': 'forged' })).status,
      400,
    );
    const header = real.webhooks.generateTestHeaderString({
      payload: event,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    subscriptions = [
      {
        id: 'sub_local',
        status: 'active',
        items: {
          data: [
            {
              price: { id: 'price_local' },
              current_period_end: Math.floor(Date.now() / 1000) + 86400,
            },
          ],
        },
      },
    ];
    assert.equal(
      (await post('/billing/webhook', event, { 'stripe-signature': header })).status,
      200,
    );
    assert.equal((await current()).active, true);
    assert.equal((await post('/billing/checkout', {})).status, 409);
    subscriptions[0].status = 'canceled';
    assert.equal(
      (await post('/billing/webhook', event, { 'stripe-signature': header })).status,
      200,
    );
    assert.equal((await current()).active, false);
    subscriptions[0].status = 'active';
    subscriptions[0].items.data[0].price.id = 'price_unrelated';
    await post('/billing/sync', {});
    assert.equal((await current()).active, false);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
    for (const k of vars)
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
  }
});
