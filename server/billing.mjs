import { fail } from './errors.mjs';
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
        const eligible = subscriptions.filter((s) =>
          s.items.data.some((i) => i.price.id === config.stripePrice),
        );
        const sub = eligible.find((s) => ['active', 'trialing'].includes(s.status)) || eligible[0];
        const matching = sub?.items.data.filter((i) => i.price.id === config.stripePrice) || [];
        const expires = sub
          ? Math.max(0, ...matching.map((i) => i.current_period_end || 0), sub.trial_end || 0) *
            1000
          : 0;
        repo.updateSubscription(customer, sub?.status || 'inactive', expires, sub?.id || null);
      });
    syncQueues.set(customer, current);
    return current.finally(() => {
      if (syncQueues.get(customer) === current) syncQueues.delete(customer);
    });
  }
  return {
    syncCustomer,
    async checkout(user) {
      if (!stripe) throw fail(400, 'Activez l’abonnement de démonstration.');
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
        if (isActive(repo.userById(user.id)))
          throw fail(409, 'Un abonnement est déjà actif. Utilisez le portail de facturation.');
        const prior = repo.getCheckout(user.id);
        if (prior) {
          const existing = await stripe.checkout.sessions.retrieve(prior);
          if (existing.status === 'open' && existing.url) return { url: existing.url };
        }
        const checkout = await stripe.checkout.sessions.create(
          {
            mode: 'subscription',
            customer,
            line_items: [{ price: config.stripePrice, quantity: 1 }],
            success_url: config.appUrl + '/?billing=success',
            cancel_url: config.appUrl + '/?billing=cancel',
            client_reference_id: user.id,
          },
          { idempotencyKey: 'clair-checkout-' + user.id + '-' + (prior || 'first') },
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
