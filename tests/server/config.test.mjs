import { test, expect } from 'vitest';
import { loadConfig } from '../../server/config.mjs';
test('safe defaults and immutable explicit configuration', () => {
  const config = loadConfig({}, {});
  expect(config.mode).toBe('demo');
  expect(config.host).toBe('127.0.0.1');
  expect(Object.isFrozen(config)).toBe(true);
  expect(loadConfig({ port: 3456 }, {}).appUrl).toBe('http://localhost:3456');
});
test('reject unsafe deployment and ambiguous origins', () => {
  for (const options of [
    { production: true },
    { host: '0.0.0.0' },
    { appUrl: 'https://external.test' },
    { appUrl: 'ftp://localhost' },
    { appUrl: 'http://user:pass@localhost' },
    { appUrl: 'http://localhost/path' },
    { port: -1 },
    { mode: 'unknown' },
  ])
    expect(() => loadConfig(options, {})).toThrow();
  expect(() => loadConfig({ mode: 'stripe' }, {})).toThrow(/Stripe/);
  const env = {
    STRIPE_SECRET_KEY: 'sk_live_secret',
    STRIPE_PRICE_ID: 'price',
    STRIPE_WEBHOOK_SECRET: 'whsec',
  };
  expect(() => loadConfig({ mode: 'stripe' }, env)).toThrow(/autorisé/);
  expect(
    loadConfig(
      { mode: 'stripe', production: true, appUrl: 'https://clair.test' },
      { ...env, ALLOW_LIVE_PAYMENTS: 'true', ADMIN_USER_IDS: ' one, two ' },
    ).adminIds,
  ).toEqual(['one', 'two']);
});

test('plan prices cannot collide and essential retains its existing environment variable', () => {
  expect(
    loadConfig({}, { STRIPE_PRICE_ID: 'legacy', STRIPE_PRICE_PRO: 'pro' }).stripePrices,
  ).toEqual({ essential: 'legacy', pro: 'pro' });
  expect(() =>
    loadConfig({}, { STRIPE_PRICE_ESSENTIAL: 'same', STRIPE_PRICE_PRO: 'same' }),
  ).toThrow('distinct');
});

test('embedded Stripe requires matching publishable and secret environments', () => {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_PRICE_ESSENTIAL: 'price_e',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  };
  expect(loadConfig({ mode: 'stripe' }, env).stripePublishableKey).toBe('');
  expect(
    loadConfig({ mode: 'stripe' }, { ...env, STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture' })
      .stripePublishableKey,
  ).toBe('pk_test_fixture');
  expect(() =>
    loadConfig({ mode: 'stripe' }, { ...env, STRIPE_PUBLISHABLE_KEY: 'pk_live_fixture' }),
  ).toThrow(/environnement/);
  expect(() => loadConfig({}, { STRIPE_PUBLISHABLE_KEY: 'sk_test_not_public' })).toThrow(
    /publique/,
  );
});

test('restricted live keys require the same live-payment opt-in', () => {
  const env = {
    STRIPE_SECRET_KEY: 'rk_live_fixture',
    STRIPE_PRICE_ESSENTIAL: 'price_e',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_PUBLISHABLE_KEY: 'pk_live_fixture',
  };
  expect(() => loadConfig({ mode: 'stripe' }, env)).toThrow(/autorisé/);
  expect(
    loadConfig({ mode: 'stripe' }, { ...env, ALLOW_LIVE_PAYMENTS: 'true' }).paymentEnvironment,
  ).toBe('live');
});

test('a development server cannot be exposed even when Stripe is configured', () => {
  const env = {
    BILLING_MODE: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_PRICE_ID: 'price',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  };
  expect(() => loadConfig({ host: '0.0.0.0' }, env)).toThrow(/locale/);
  expect(() => loadConfig({ appUrl: 'https://public.example.test' }, env)).toThrow(/locale/);
});
