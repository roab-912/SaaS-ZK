import { fail } from './errors.mjs';
import { createPricing } from './pricing.mjs';
import { createBillingCheckout } from './billing-checkout.mjs';
import { createBillingManagement } from './billing-management.mjs';
import { PLANS, priceFor } from './plans.mjs';
export function createBilling({ stripe, repo, config, isActive }) {
  const checkoutLocks = new Set(),
    syncQueues = new Map();
  async function withLock(userId, work) {
    if (checkoutLocks.has(userId))
      throw fail(
        409,
        'Une mise à jour de facturation est déjà en cours. Réessayez dans un instant.',
      );
    checkoutLocks.add(userId);
    try {
      return await work();
    } finally {
      checkoutLocks.delete(userId);
    }
  }
  function syncCustomer(customer) {
    const previous = syncQueues.get(customer) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        const subscriptions = [];
        let cursor;
        do {
          const page = await stripe.subscriptions.list({
            customer,
            status: 'all',
            limit: 100,
            ...(cursor ? { starting_after: cursor } : {}),
          });
          subscriptions.push(...page.data);
          cursor = page.has_more ? page.data.at(-1)?.id : undefined;
        } while (cursor);
        const plans = PLANS.filter((p) => priceFor(config, p.id));
        if (subscriptions.some((s) => s.trial_start || s.trial_end)) repo.markTrialUsed(customer);
        const eligible = subscriptions
          .filter((s) =>
            s.items.data.some((i) => plans.some((p) => i.price.id === priceFor(config, p.id))),
          )
          .sort((a, b) => (b.created || 0) - (a.created || 0));
        const sub = eligible.find((s) => ['active', 'trialing'].includes(s.status)) || eligible[0];
        const plan = [...plans]
          .reverse()
          .find((p) => sub?.items.data.some((i) => i.price.id === priceFor(config, p.id)));
        const matching =
          sub?.items.data.filter((i) => i.price.id === priceFor(config, plan?.id)) || [];
        let expires = sub
          ? Math.max(0, ...matching.map((i) => i.current_period_end || 0), sub.trial_end || 0) *
            1000
          : 0;
        if (sub?.status === 'trialing') {
          let method = sub.default_payment_method || sub.default_source;
          if (!method) {
            const customerRecord = await stripe.customers.retrieve(customer);
            method =
              !customerRecord.deleted &&
              (customerRecord.invoice_settings?.default_payment_method ||
                customerRecord.default_source);
          }
          expires = method ? (sub.trial_end || 0) * 1000 : 0;
        }
        repo.updateSubscription(
          customer,
          sub?.status || 'inactive',
          expires,
          sub?.id || null,
          plan?.id || 'essential',
        );
        return sub ?? null;
      });
    syncQueues.set(customer, current);
    return current.finally(() => {
      if (syncQueues.get(customer) === current) syncQueues.delete(customer);
    });
  }
  const plans = createPricing({ stripe, config });
  const dependencies = { stripe, repo, config, isActive, withLock, syncCustomer, plans };
  return {
    syncCustomer,
    plans,
    ...createBillingCheckout(dependencies),
    ...createBillingManagement(dependencies),
  };
}
