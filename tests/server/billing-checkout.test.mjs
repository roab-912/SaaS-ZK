import { afterEach, test, expect } from 'vitest';
import { billingFixture } from '../helpers/billing.mjs';
const fixtures = [];
const fixture = (o) => {
  const f = billingFixture(o);
  fixtures.push(f);
  return f;
};
afterEach(() => {
  for (const f of fixtures.splice(0)) f.db.close();
});
test('embedded checkout reuses an owned open session, fixes price and requires a card for the single trial', async () => {
  const f = fixture();
  const result = await f.billing.checkout(f.user, 'pro');
  expect(result).toMatchObject({ sessionId: 'cs_fixture', mode: 'subscription', trialDays: 30 });
  expect(result.url).toBeUndefined();
  expect(f.stripe.checkout.sessions.create.mock.lastCall[0]).toMatchObject({
    ui_mode: 'custom',
    customer: 'cus',
    line_items: [{ price: 'price_p', quantity: 1 }],
    payment_method_collection: 'always',
    subscription_data: { trial_period_days: 30 },
    return_url: 'https://clair.test/abonnement/retour?session_id={CHECKOUT_SESSION_ID}',
  });
  await f.billing.checkout(f.user, 'pro');
  expect(f.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  await f.billing.checkout(f.user, 'essential');
  expect(f.stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_fixture');
});
test('completion never trusts a client session belonging to another user or customer', async () => {
  const f = fixture();
  await f.billing.checkout(f.user);
  await expect(f.billing.complete(f.user, 'cs_foreign')).rejects.toMatchObject({ status: 404 });
  f.session.customer = 'cus_foreign';
  await expect(f.billing.complete(f.user, 'cs_fixture')).rejects.toMatchObject({ status: 403 });
  expect(f.stripe.customers.update).not.toHaveBeenCalled();
});
test('card update requires a completed setup intent owned by the current customer', async () => {
  const f = fixture({ subscribed: true });
  await f.billing.setupPaymentMethod(f.user);
  expect(f.stripe.checkout.sessions.create.mock.lastCall[0]).toMatchObject({
    mode: 'setup',
    ui_mode: 'custom',
    metadata: { subscription: 'sub', purpose: 'payment_method' },
  });
  await f.billing.complete(f.user, 'cs_fixture');
  expect(f.stripe.customers.update).not.toHaveBeenCalled();
  f.session.status = 'complete';
  f.session.setup_intent = 'seti_fixture';
  f.stripe.setupIntents.retrieve.mockResolvedValueOnce({
    status: 'succeeded',
    customer: 'foreign',
    payment_method: 'pm_new',
  });
  await expect(f.billing.complete(f.user, 'cs_fixture')).rejects.toMatchObject({ status: 409 });
  await f.billing.complete(f.user, 'cs_fixture');
  expect(f.stripe.customers.update).toHaveBeenCalledWith(
    'cus',
    { invoice_settings: { default_payment_method: 'pm_new' } },
    expect.any(Object),
  );
  expect(f.sub.default_payment_method).toBe('pm_new');
});
test('webhook card updates ignore foreign sessions and process only the locally saved session', async () => {
  const f = fixture({ subscribed: true });
  await f.billing.setupPaymentMethod(f.user);
  f.session.status = 'complete';
  f.session.setup_intent = 'seti_fixture';
  await f.billing.completeWebhook({ ...f.session, id: 'cs_other' });
  expect(f.stripe.customers.update).not.toHaveBeenCalled();
  await f.billing.completeWebhook(f.session);
  expect(f.stripe.customers.update).toHaveBeenCalledTimes(1);
});
test('missing publishable key fails before creating a customer or checkout', async () => {
  const f = fixture();
  f.config.stripePublishableKey = '';
  await expect(f.billing.checkout(f.user)).rejects.toMatchObject({ status: 503 });
  expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
});
