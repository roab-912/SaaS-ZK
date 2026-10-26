import { catalog, priceFor } from './plans.mjs';
export function createPricing({ stripe, config, now = Date.now }) {
  let cached,
    until = 0,
    pending;
  return async () => {
    if (!stripe) return catalog(config).map((p) => ({ ...p, available: false, price: null }));
    if (cached && now() < until) return cached;
    if (pending) return pending;
    pending = Promise.all(
      catalog(config).map(async (plan) => {
        const id = priceFor(config, plan.id);
        if (!id) return { ...plan, available: false, price: null };
        try {
          const p = await stripe.prices.retrieve(id);
          if (
            !p.active ||
            p.type !== 'recurring' ||
            p.billing_scheme !== 'per_unit' ||
            !Number.isSafeInteger(p.unit_amount) ||
            p.unit_amount < 0 ||
            !/^[a-z]{3}$/.test(p.currency) ||
            !['day', 'week', 'month', 'year'].includes(p.recurring?.interval) ||
            !Number.isSafeInteger(p.recurring.interval_count) ||
            p.recurring.interval_count < 1 ||
            (p.recurring.usage_type && p.recurring.usage_type !== 'licensed')
          )
            throw Error('Unsupported price');
          return {
            ...plan,
            available: true,
            price: {
              amount: p.unit_amount,
              currency: p.currency,
              interval: p.recurring.interval,
              intervalCount: p.recurring.interval_count,
              taxBehavior: p.tax_behavior || 'unspecified',
            },
          };
        } catch {
          return {
            ...plan,
            available: false,
            price: null,
            priceError: 'Tarif Stripe indisponible. Vérifiez la configuration du serveur.',
          };
        }
      }),
    )
      .then((value) => {
        cached = value;
        until = now() + 60000;
        return value;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
