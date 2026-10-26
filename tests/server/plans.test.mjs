import { test, expect } from 'vitest';
import { PLANS, planFor, monthWindow, catalog } from '../../server/plans.mjs';
test('catalog pins limits and resets at the next UTC month', () => {
  expect(planFor('pro').generations).toBe(1000);
  expect(() => planFor('client-unlimited')).toThrow('Offre inconnue');
  expect(Object.isFrozen(PLANS[0])).toBe(true);
  expect(monthWindow(Date.parse('2026-12-31T23:59:59Z'))).toEqual({
    period: '2026-12',
    resets: Date.parse('2027-01-01T00:00:00Z'),
  });
  expect(catalog({ mode: 'stripe', stripePrice: 'price' }).map((p) => p.available)).toEqual([
    true,
    false,
  ]);
});
