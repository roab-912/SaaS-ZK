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
  const billing = createBilling({ stripe, repo, config: { stripePrice: 'price' } });
  await billing.syncCustomer('cus');
  expect(stripe.subscriptions.list.mock.calls[1][0].starting_after).toBe('old');
  expect(repo.updateSubscription).toHaveBeenCalledWith('cus', 'active', 20000, 'sub');
});
test('checkout errors release the lock and unavailable billing fails explicitly', async () => {
  const repo = { userById: () => ({ customer: 'cus' }) },
    stripe = { subscriptions: { list: vi.fn().mockRejectedValue(Error('offline')) } };
  const billing = createBilling({ stripe, repo, config: {}, isActive: () => false });
  await expect(billing.checkout({ id: 'u' })).rejects.toThrow('offline');
  await expect(billing.checkout({ id: 'u' })).rejects.toThrow('offline');
  const disabled = createBilling({ stripe: null, repo, config: {} });
  await expect(disabled.checkout({ id: 'u' })).rejects.toMatchObject({ status: 400 });
  await expect(disabled.portal({ id: 'u' })).rejects.toMatchObject({ status: 400 });
});
