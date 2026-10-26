import { test, expect, vi } from 'vitest';
import { createPricing } from '../../server/pricing.mjs';
test('prices come from Stripe, are cached, and hide invalid configuration without leaking provider errors', async () => {
  const retrieve = vi.fn(async (id) => {
    if (id === 'bad') throw Error('sk_test_secret');
    return {
      active: true,
      type: 'recurring',
      billing_scheme: 'per_unit',
      unit_amount: 1900,
      currency: 'eur',
      recurring: { interval: 'month', interval_count: 1 },
      tax_behavior: 'inclusive',
    };
  });
  let time = 0;
  const read = createPricing({
    stripe: { prices: { retrieve } },
    config: { mode: 'stripe', stripePrices: { essential: 'good', pro: 'bad' } },
    now: () => time,
  });
  const [a, b] = await Promise.all([read(), read()]);
  expect(a).toEqual(b);
  expect(a[0].price).toMatchObject({ amount: 1900, currency: 'eur', interval: 'month' });
  expect(a[1].available).toBe(false);
  expect(JSON.stringify(a)).not.toContain('secret');
  await read();
  expect(retrieve).toHaveBeenCalledTimes(2);
  time = 61000;
  await read();
  expect(retrieve).toHaveBeenCalledTimes(4);
});
