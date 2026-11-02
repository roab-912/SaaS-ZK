import { test, expect, vi, afterEach } from 'vitest';
import { loadStripe } from '@stripe/stripe-js/pure';
import {
  paymentStripe,
  themedStripeAppearance,
  stripeAppearance,
} from '../../../src/lib/stripe-client.js';
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
test('Stripe loads only on a nonisolated payment document and caches successful initialization', async () => {
  await expect(paymentStripe('')).rejects.toThrow(/configur/);
  vi.stubGlobal('crossOriginIsolated', true);
  await expect(paymentStripe('pk_test_isolated')).rejects.toThrow(/page de paiement/);
  expect(loadStripe).not.toHaveBeenCalled();
  vi.stubGlobal('crossOriginIsolated', false);
  loadStripe.mockResolvedValue({ fixture: true });
  expect(await paymentStripe('pk_test_valid')).toEqual({ fixture: true });
  await paymentStripe('pk_test_valid');
  expect(loadStripe).toHaveBeenCalledTimes(1);
  expect(loadStripe).toHaveBeenCalledWith('pk_test_valid', { locale: 'fr' });
});
test('initialization failures allow a later retry', async () => {
  loadStripe.mockRejectedValueOnce(Error('network'));
  await expect(paymentStripe('pk_test_retry')).rejects.toThrow('network');
  loadStripe.mockResolvedValueOnce({ fixture: true });
  expect(await paymentStripe('pk_test_retry')).toEqual({ fixture: true });
});

test('appearance follows Clair without changing the light default or loading Stripe', () => {
  const light = JSON.stringify(stripeAppearance),
    dark = themedStripeAppearance('dark');
  expect(dark.theme).toBe('night');
  expect(dark.variables.colorBackground).toBe('#192720');
  expect(themedStripeAppearance('light')).toEqual(stripeAppearance);
  expect(JSON.stringify(stripeAppearance)).toBe(light);
});
