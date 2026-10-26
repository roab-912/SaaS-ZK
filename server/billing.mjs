import { fail } from './errors.mjs';
import { createPricing } from './pricing.mjs';
import { PLANS, planFor, priceFor } from './plans.mjs';
export function createBilling({ stripe, repo, config, isActive }) {
  const checkoutLocks = new Set(),
    syncQueues = new Map();
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
      });
    syncQueues.set(customer, current);
    return current.finally(() => {
      if (syncQueues.get(customer) === current) syncQueues.delete(customer);
    });
  }
  return {
    syncCustomer,
    plans: createPricing({ stripe, config }),
    async checkout(user, planId = 'essential') {
      planFor(planId);
      if (!stripe) throw fail(400, 'Activez l’abonnement de démonstration.');
      const price = priceFor(config, planId);
      if (!price) throw fail(400, 'Cette offre n’est pas encore disponible au paiement.');
      if (checkoutLocks.has(user.id)) throw fail(409, 'Paiement en cours de préparation.');
      checkoutLocks.add(user.id);
      try {
        let customer = repo.userById(user.id).customer;
        if (!customer) {
          customer = (
            await stripe.customers.create(
              { email: user.email, metadata: { userId: user.id } },
              { idempotencyKey: 'clair-customer-' + user.id },
            )
          ).id;
          repo.setCustomer(user.id, customer);
        }
        await syncCustomer(customer);
        const fresh = repo.userById(user.id);
        if (
          isActive(fresh) ||
          (fresh.subscription &&
            !['canceled', 'incomplete_expired', 'inactive'].includes(fresh.status))
        )
          throw fail(409, 'Un abonnement existe déjà. Utilisez le portail de facturation.');
        const trial = !fresh.trial_used;
        const prior = repo.getCheckout(user.id);
        if (prior) {
          const existing = await stripe.checkout.sessions.retrieve(prior);
          if (existing.status === 'open' && existing.url) {
            if (
              existing.metadata?.plan === planId &&
              existing.metadata?.trial === (trial ? '30' : '0')
            )
              return { url: existing.url };
            await stripe.checkout.sessions.expire(prior);
          }
        }
        const checkout = await stripe.checkout.sessions.create(
          {
            mode: 'subscription',
            customer,
            line_items: [{ price, quantity: 1 }],
            payment_method_types: ['card'],
            payment_method_collection: 'always',
            locale: 'fr',
            metadata: { plan: planId, userId: user.id, trial: trial ? '30' : '0' },
            subscription_data: {
              metadata: { plan: planId, userId: user.id },
              ...(trial
                ? {
                    trial_period_days: 30,
                    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
                  }
                : {}),
            },
            success_url: config.appUrl + '/?billing=success',
            cancel_url: config.appUrl + '/?billing=cancel',
            client_reference_id: user.id,
          },
          { idempotencyKey: 'clair-checkout-' + user.id + '-' + planId + '-' + (prior || 'first') },
        );
        repo.setCheckout(user.id, checkout.id);
        return { url: checkout.url };
      } finally {
        checkoutLocks.delete(user.id);
      }
    },
    async portal(user) {
      if (!stripe || !user.customer) throw fail(400, 'Aucun compte de facturation.');
      const session = await stripe.billingPortal.sessions.create({
        customer: user.customer,
        return_url: config.appUrl + '/?billing=return',
      });
      return { url: session.url };
    },
  };
}
