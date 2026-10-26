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
