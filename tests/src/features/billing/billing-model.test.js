import { test, expect } from 'vitest';
import {
  billingPath,
  money,
  recurringPrice,
} from '../../../../src/features/billing/billing-model.js';
test('billing links stay on Clair and accept only known plan identifiers', () => {
  expect(billingPath('checkout', 'pro')).toBe('/abonnement/paiement?offre=pro');
  expect(billingPath('manage', 'essential')).toBe('/abonnement/gestion?offre=essential');
  expect(billingPath('payment-method', 'https://evil.test')).toBe('/abonnement/moyen-de-paiement');
});
test('recurring prices respect currency minor units and periods', () => {
  expect(money(3999, 'eur')).toMatch(/39,99/);
  expect(money(100, 'jpy')).toMatch(/100/);
  expect(
    recurringPrice({ amount: 3900, currency: 'eur', interval: 'month', intervalCount: 3 }),
  ).toMatch(/39,00.*3 mois/);
  expect(recurringPrice(null)).toBe('Tarif indisponible');
});
