import { vi } from 'vitest';
import { openDatabase } from '../../server/database.mjs';
import { createRepository } from '../../server/repository.mjs';
import { createBilling } from '../../server/billing.mjs';
export function billingFixture({ subscribed = false, trial = false } = {}) {
  const db = openDatabase(':memory:'),
    repo = createRepository(db);
  const user = repo.createUser('billing@example.test', 'unused');
  repo.setCustomer(user.id, 'cus');
  const config = {
    stripePublishableKey: 'pk_test_fixture',
    stripePrices: { essential: 'price_e', pro: 'price_p' },
    appUrl: 'https://clair.test',
  };
  const price = (id) => ({
    id,
    currency: 'eur',
    active: true,
    type: 'recurring',
    unit_amount: id === 'price_p' ? 3999 : 1900,
    billing_scheme: 'per_unit',
    tax_behavior: 'inclusive',
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  });
  let sub = subscribed
    ? {
        id: 'sub',
        customer: 'cus',
        status: trial ? 'trialing' : 'active',
        default_payment_method: 'pm_card',
        trial_end: trial ? Math.floor(Date.now() / 1000) + 86400 : null,
        trial_start: trial ? 1 : null,
        created: 1,
        metadata: {},
        items: {
          data: [
            {
              id: 'si',
              quantity: 1,
              price: price('price_e'),
              current_period_end: Math.floor(Date.now() / 1000) + 864000,
            },
          ],
        },
      }
    : null;
  let savedSession;
  const stripe = {
    prices: { retrieve: vi.fn(async (id) => price(id)) },
    customers: {
      retrieve: vi.fn(async () => ({
        id: 'cus',
        invoice_settings: { default_payment_method: 'pm_card' },
      })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({ id: 'cus' })),
    },
    paymentMethods: {
      retrieve: vi.fn(async (id) => ({
        id,
        type: 'card',
        customer: 'cus',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      })),
    },
    setupIntents: {
      retrieve: vi.fn(async () => ({
        status: 'succeeded',
        customer: 'cus',
        payment_method: 'pm_new',
      })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: sub ? [sub] : [] })),
      retrieve: vi.fn(async () => sub),
      update: vi.fn(async (id, patch) => {
        if (patch.items) sub.items.data[0].price = price(patch.items[0].price);
        if (patch.trial_end === 'now') {
          sub.status = 'active';
          sub.trial_end = Math.floor(Date.now() / 1000);
        }
        if (patch.metadata) sub.metadata = { ...sub.metadata, ...patch.metadata };
        if ('cancel_at_period_end' in patch) sub.cancel_at_period_end = patch.cancel_at_period_end;
        if (patch.default_payment_method) sub.default_payment_method = patch.default_payment_method;
        return sub;
      }),
    },
    invoices: {
      createPreview: vi.fn(async () => ({ amount_due: 3999, total: 3999, currency: 'eur' })),
      retrieve: vi.fn(async () => ({
        status: 'open',
        customer: 'cus',
        currency: 'eur',
        amount_remaining: 3999,
        confirmation_secret: { client_secret: 'pi_fixture_secret_fixture' },
      })),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(async () => savedSession),
        expire: vi.fn(async () => ({})),
        create: vi.fn(async (options) => {
          savedSession = {
            ...options,
            id: 'cs_fixture',
            status: 'open',
            client_secret: 'cs_fixture_secret_fixture',
          };
          return savedSession;
        }),
      },
    },
  };
  const billing = createBilling({
    stripe,
    repo,
    config,
    isActive: (u) =>
      !!u?.subscription && ['active', 'trialing'].includes(u.status) && u.expires > Date.now(),
  });
  return {
    db,
    repo,
    user,
    config,
    stripe,
    billing,
    get sub() {
      return sub;
    },
    set sub(value) {
      sub = value;
    },
    get session() {
      return savedSession;
    },
    set session(value) {
      savedSession = value;
    },
  };
}
