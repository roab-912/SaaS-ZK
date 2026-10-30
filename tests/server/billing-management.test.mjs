import { afterEach, test, expect } from 'vitest';
import { billingFixture } from '../helpers/billing.mjs';
import { createBillingManagement } from '../../server/billing-management.mjs';
const fixtures = [];
const fixture = (o) => {
  const f = billingFixture({ subscribed: true, ...o });
  fixtures.push(f);
  return f;
};
afterEach(() => {
  for (const f of fixtures.splice(0)) f.db.close();
});
test('an authenticated quote ends the trial, confirms no proration and is idempotent', async () => {
  const f = fixture({ trial: true });
  const quote = await f.billing.preview(f.user, 'pro');
  expect(quote).toMatchObject({
    endsTrial: true,
    amountDueNow: 3999,
    proration: 'none',
    plan: 'pro',
  });
  await expect(f.billing.change(f.user, 'essential', quote.token)).rejects.toMatchObject({
    status: 409,
  });
  await expect(f.billing.change({ id: 'foreign' }, 'pro', quote.token)).rejects.toMatchObject({
    status: 409,
  });
  await f.billing.change(f.user, 'pro', quote.token);
  await f.billing.change(f.user, 'pro', quote.token);
  expect(f.stripe.subscriptions.update).toHaveBeenCalledTimes(1);
  expect(f.stripe.subscriptions.update.mock.lastCall[1]).toMatchObject({
    trial_end: 'now',
    proration_behavior: 'none',
    payment_behavior: 'default_incomplete',
    items: [{ id: 'si', price: 'price_p', quantity: 1 }],
  });
  expect(f.repo.userById(f.user.id)).toMatchObject({
    plan: 'pro',
    status: 'active',
    trial_used: 1,
  });
});
test('paid plans change immediately without a second charge in the same billing interval', async () => {
  const f = fixture();
  const q = await f.billing.preview(f.user, 'pro');
  expect(q).toMatchObject({ endsTrial: false, amountDueNow: 0, renewsAt: expect.any(Number) });
  await f.billing.change(f.user, 'pro', q.token);
  expect(f.stripe.subscriptions.update.mock.lastCall[1].trial_end).toBeUndefined();
  const down = await f.billing.preview(f.user, 'essential');
  await f.billing.change(f.user, 'essential', down.token);
  expect(f.repo.userById(f.user.id).plan).toBe('essential');
});
test('changed amounts and expired quotes require new consent', async () => {
  const f = fixture({ trial: true });
  let clock = 0;
  const billing = createBillingManagement({
    stripe: f.stripe,
    repo: f.repo,
    config: f.config,
    syncCustomer: f.billing.syncCustomer,
    plans: f.billing.plans,
    withLock: async (id, work) => work(),
    now: () => clock,
  });
  let q = await billing.preview(f.user, 'pro');
  f.stripe.invoices.createPreview.mockResolvedValueOnce({
    amount_due: 4000,
    total: 4000,
    currency: 'eur',
  });
  await expect(billing.change(f.user, 'pro', q.token)).rejects.toMatchObject({ status: 409 });
  q = await billing.preview(f.user, 'pro');
  clock = 300001;
  await expect(billing.change(f.user, 'pro', q.token)).rejects.toMatchObject({ status: 409 });
  expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
});
test('unpaid changes return only the owning invoice confirmation and never keep trial access', async () => {
  const f = fixture({ trial: true });
  const q = await f.billing.preview(f.user, 'pro');
  f.stripe.subscriptions.update.mockImplementationOnce(async () => {
    f.sub.status = 'past_due';
    f.sub.latest_invoice = 'in_fixture';
    return f.sub;
  });
  const result = await f.billing.change(f.user, 'pro', q.token);
  expect(result.pendingPayment).toMatchObject({ amount: 3999, currency: 'eur' });
  expect(f.repo.userById(f.user.id).status).toBe('past_due');
  f.stripe.invoices.retrieve.mockResolvedValueOnce({ customer: 'foreign' });
  await expect(f.billing.state(f.user)).rejects.toMatchObject({ status: 403 });
});
test('card state is masked and only renewal cancellation can be toggled', async () => {
  const f = fixture();
  expect(await f.billing.state(f.user)).toMatchObject({
    card: { last4: '4242' },
    subscription: { plan: 'essential' },
  });
  await f.billing.renewal(f.user, true);
  await expect(f.billing.preview(f.user, 'pro')).rejects.toMatchObject({ status: 409 });
  await f.billing.renewal(f.user, false);
  expect(f.sub.cancel_at_period_end).toBe(false);
  f.sub.items.data.push({ ...f.sub.items.data[0], id: 'unexpected' });
  await expect(f.billing.preview(f.user, 'pro')).rejects.toMatchObject({ status: 409 });
});
