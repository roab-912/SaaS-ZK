import { test, expect, vi } from 'vitest';
import { createBilling } from '../../server/billing.mjs';
test('subscription pagination uses only the subscribed product expiry', async () => {
  const repo = { updateSubscription: vi.fn() },
    stripe = {
      subscriptions: {
        list: vi
          .fn()
          .mockResolvedValueOnce({ data: [{ id: 'old', items: { data: [] } }], has_more: true })
          .mockResolvedValueOnce({
            data: [
              {
                id: 'sub',
                status: 'active',
                items: {
                  data: [
                    { price: { id: 'price' }, current_period_end: 20 },
                    { price: { id: 'other' }, current_period_end: 9999 },
                  ],
                },
              },
            ],
          }),
      },
    };
  const billing = createBilling({
    stripe,
    repo,
    config: { stripePrice: 'price', stripePublishableKey: 'pk_test_fixture' },
  });
  await billing.syncCustomer('cus');
  expect(stripe.subscriptions.list.mock.calls[1][0].starting_after).toBe('old');
  expect(repo.updateSubscription).toHaveBeenCalledWith('cus', 'active', 20000, 'sub', 'essential');
});
test('checkout errors release the lock and unavailable billing fails explicitly', async () => {
  const repo = { userById: () => ({ customer: 'cus' }) },
    stripe = { subscriptions: { list: vi.fn().mockRejectedValue(Error('offline')) } };
  const billing = createBilling({
    stripe,
    repo,
    config: { stripePrice: 'price', stripePublishableKey: 'pk_test_fixture' },
    isActive: () => false,
  });
  await expect(billing.checkout({ id: 'u' })).rejects.toThrow('offline');
  await expect(billing.checkout({ id: 'u' })).rejects.toThrow('offline');
  const disabled = createBilling({ stripe: null, repo, config: {} });
  await expect(disabled.checkout({ id: 'u' })).rejects.toMatchObject({ status: 400 });
  await expect(disabled.setupPaymentMethod({ id: 'u' })).rejects.toMatchObject({ status: 400 });
});

test('checkout selects configured plans, expires an open checkout for another plan and reconciles upgrades', async () => {
  const config = {
    stripePrices: { essential: 'price_e', pro: 'price_p' },
    appUrl: 'https://clair.test',
    stripePublishableKey: 'pk_test_fixture',
  };
  let user = { id: 'u', customer: 'cus', status: 'inactive' };
  let subscriptions = [];
  const repo = {
    userById: () => user,
    getCheckout: () => 'old',
    setCheckout: vi.fn(),
    updateSubscription: vi.fn((customer, status, expires, subscription, plan) => {
      user = { ...user, status, expires, subscription, plan };
    }),
  };
  const stripe = {
    subscriptions: { list: vi.fn(async () => ({ data: subscriptions })) },
    checkout: {
      sessions: {
        retrieve: vi.fn(async () => ({
          status: 'open',
          url: 'https://checkout.stripe.com/old',
          metadata: { plan: 'essential' },
        })),
        expire: vi.fn(async () => ({})),
        create: vi.fn(async () => ({
          id: 'new',
          mode: 'subscription',
          client_secret: 'fixture_secret',
        })),
      },
    },
  };
  const billing = createBilling({ stripe, repo, config, isActive: (u) => u.status === 'active' });
  await expect(billing.checkout(user, 'unlimited')).rejects.toMatchObject({ status: 400 });
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(await billing.checkout(user, 'pro')).toEqual({
    sessionId: 'new',
    mode: 'subscription',
    clientSecret: 'fixture_secret',
    plan: 'pro',
    trialDays: 30,
  });
  expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('old');
  expect(stripe.checkout.sessions.create.mock.lastCall[0]).toMatchObject({
    line_items: [{ price: 'price_p', quantity: 1 }],
    mode: 'subscription',
    payment_method_types: ['card'],
    metadata: { plan: 'pro' },
  });
  subscriptions = [
    {
      id: 'sub',
      status: 'active',
      items: { data: [{ price: { id: 'price_p' }, current_period_end: 1000 }] },
    },
  ];
  await billing.syncCustomer('cus');
  expect(user).toMatchObject({ plan: 'pro', status: 'active', expires: 1000000 });
  await expect(billing.checkout(user, 'essential')).rejects.toMatchObject({ status: 409 });
  subscriptions[0].status = 'past_due';
  await billing.syncCustomer('cus');
  await expect(billing.checkout(user, 'essential')).rejects.toMatchObject({ status: 409 });
  subscriptions[0].items.data[0].price.id = 'price_e';
  subscriptions[0].status = 'active';
  await billing.syncCustomer('cus');
  expect(user.plan).toBe('essential');
});

test('both offers get one Stripe trial per account, require a payment method, and never renew it after cancellation', async () => {
  const { openDatabase } = await import('../../server/database.mjs');
  const { createRepository } = await import('../../server/repository.mjs');
  for (const firstPlan of ['essential', 'pro']) {
    const db = openDatabase(':memory:'),
      repo = createRepository(db);
    try {
      const user = repo.createUser(firstPlan + '@test.fr', 'hash');
      repo.setCustomer(user.id, 'cus');
      let subscriptions = [];
      const create = vi.fn(async () => ({
        id: 'cs',
        mode: 'subscription',
        client_secret: 'fixture_secret',
      }));
      const stripe = {
        subscriptions: { list: async () => ({ data: subscriptions }) },
        checkout: { sessions: { create, retrieve: async () => ({ status: 'complete' }) } },
        customers: { retrieve: async () => ({ invoice_settings: {} }) },
      };
      const billing = createBilling({
        stripe,
        repo,
        config: {
          stripePrices: { essential: 'price_e', pro: 'price_p' },
          appUrl: 'https://clair.test',
          stripePublishableKey: 'pk_test_fixture',
        },
        isActive: (u) => ['active', 'trialing'].includes(u.status) && u.expires > Date.now(),
      });
      await billing.checkout(user, firstPlan);
      expect(create.mock.lastCall[0]).toMatchObject({
        payment_method_collection: 'always',
        subscription_data: {
          trial_period_days: 30,
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        },
      });
      const end = Math.floor(Date.now() / 1000) + 86400;
      subscriptions = [
        {
          id: 'sub',
          status: 'trialing',
          trial_start: end - 100,
          trial_end: end,
          default_payment_method: 'pm_card',
          items: {
            data: [
              {
                price: { id: firstPlan === 'pro' ? 'price_p' : 'price_e' },
                current_period_end: end + 999999,
              },
            ],
          },
        },
      ];
      await billing.syncCustomer('cus');
      expect(repo.userById(user.id)).toMatchObject({ trial_used: 1, expires: end * 1000 });
      subscriptions[0].default_payment_method = null;
      await billing.syncCustomer('cus');
      expect(repo.userById(user.id).expires).toBe(0);
      subscriptions[0].status = 'canceled';
      await billing.syncCustomer('cus');
      await billing.checkout(user, firstPlan === 'pro' ? 'essential' : 'pro');
      expect(create.mock.lastCall[0].subscription_data.trial_period_days).toBeUndefined();
      expect(create.mock.lastCall[0].payment_method_collection).toBe('always');
    } finally {
      db.close();
    }
  }
});
