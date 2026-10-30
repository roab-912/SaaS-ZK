import { randomBytes } from 'node:crypto';
import { fail } from './errors.mjs';
import { planFor, priceFor } from './plans.mjs';

const idOf = (value) => (typeof value === 'string' ? value : value?.id);
const timestamp = (seconds) => (seconds ? seconds * 1000 : 0);
export function createBillingManagement({
  stripe,
  repo,
  config,
  syncCustomer,
  plans,
  withLock,
  now = Date.now,
}) {
  const quotes = new Map();
  function sweep() {
    for (const [key, q] of quotes) if (q.expires <= now()) quotes.delete(key);
  }
  async function account(user) {
    if (!stripe) throw fail(400, 'Le paiement n’est pas configuré.');
    const fresh = repo.userById(user.id);
    if (!fresh?.customer) return { user: fresh, sub: null };
    const sub = await syncCustomer(fresh.customer);
    if (sub && idOf(sub.customer) !== fresh.customer)
      throw fail(403, 'Abonnement incompatible avec ce compte.');
    return { user: repo.userById(user.id), sub };
  }
  function itemFor(sub) {
    const items = sub?.items?.data ?? [];
    const item = items.find((i) =>
      ['essential', 'pro'].some((p) => i.price.id === priceFor(config, p)),
    );
    if (
      !item ||
      items.length !== 1 ||
      sub.items.has_more ||
      (item.quantity ?? 1) !== 1 ||
      sub.schedule ||
      (sub.collection_method && sub.collection_method !== 'charge_automatically')
    )
      throw fail(
        409,
        'Cet abonnement nécessite une vérification par le support avant modification.',
      );
    return item;
  }
  async function invoicePayment(sub) {
    if (!sub || !['past_due', 'incomplete', 'unpaid'].includes(sub.status) || !sub.latest_invoice)
      return null;
    const invoice = await stripe.invoices.retrieve(idOf(sub.latest_invoice), {
      expand: ['confirmation_secret'],
    });
    if (idOf(invoice.customer) !== idOf(sub.customer))
      throw fail(403, 'Facture incompatible avec ce compte.');
    return invoice.status === 'open' &&
      invoice.amount_remaining > 0 &&
      invoice.confirmation_secret?.client_secret
      ? {
          clientSecret: invoice.confirmation_secret.client_secret,
          amount: invoice.amount_remaining,
          currency: invoice.currency,
        }
      : null;
  }
  async function state(user) {
    const a = await account(user),
      sub = a.sub;
    let card = null;
    if (sub) {
      let method = idOf(sub.default_payment_method);
      if (!method) {
        const customer = await stripe.customers.retrieve(a.user.customer);
        if (!customer.deleted) method = idOf(customer.invoice_settings?.default_payment_method);
      }
      if (method) {
        const m = await stripe.paymentMethods.retrieve(method);
        if (idOf(m.customer) === a.user.customer && m.type === 'card' && m.card)
          card = {
            brand: m.card.brand,
            last4: m.card.last4,
            expMonth: m.card.exp_month,
            expYear: m.card.exp_year,
          };
      }
    }
    return {
      subscription: sub
        ? {
            status: sub.status,
            plan: a.user.plan,
            expires: a.user.expires,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            trialEnd: timestamp(sub.trial_end),
            periodEnd: timestamp(
              sub.items?.data?.find((i) => i.price.id === priceFor(config, a.user.plan))
                ?.current_period_end,
            ),
          }
        : null,
      card,
      pendingPayment: await invoicePayment(sub),
    };
  }
  async function makePreview(user, planId) {
    planFor(planId);
    const a = await account(user),
      sub = a.sub;
    if (!sub || !['active', 'trialing'].includes(sub.status))
      throw fail(409, 'Régularisez votre abonnement avant de changer d’offre.');
    if (sub.cancel_at_period_end)
      throw fail(409, 'Réactivez d’abord le renouvellement pour changer d’offre.');
    const item = itemFor(sub),
      target = priceFor(config, planId);
    if (!target || item.price.id === target)
      throw fail(409, 'Cette offre est déjà active ou indisponible.');
    const catalog = await plans(),
      selected = catalog.find((p) => p.id === planId);
    if (!selected?.available || !selected.price)
      throw fail(409, 'Le tarif de cette offre est indisponible.');
    if (item.price.currency !== selected.price.currency)
      throw fail(409, 'Les deux offres doivent utiliser la même devise.');
    const endsTrial = sub.status === 'trialing';
    const changesInterval =
      item.price.recurring.interval !== selected.price.interval ||
      item.price.recurring.interval_count !== selected.price.intervalCount;
    const details = {
      items: [{ id: item.id, price: target, quantity: 1 }],
      proration_behavior: 'none',
      ...(endsTrial ? { trial_end: 'now' } : {}),
    };
    const invoice = await stripe.invoices.createPreview({
      customer: a.user.customer,
      subscription: sub.id,
      subscription_details: details,
    });
    if (
      !Number.isSafeInteger(invoice.amount_due) ||
      !Number.isSafeInteger(invoice.total) ||
      invoice.currency !== selected.price.currency
    )
      throw fail(502, 'Le récapitulatif de facturation est indisponible.');
    return {
      userId: a.user.id,
      customer: a.user.customer,
      subscription: sub.id,
      item: item.id,
      fromPrice: item.price.id,
      targetPrice: target,
      targetPlan: planId,
      fromPlan: a.user.plan,
      details,
      endsTrial,
      changesInterval,
      immediateAmount: endsTrial || changesInterval ? invoice.amount_due : 0,
      nextInvoiceAmount: invoice.total,
      currency: invoice.currency,
      renewsAt: endsTrial || changesInterval ? null : timestamp(item.current_period_end),
      price: selected.price,
      planName: selected.name,
    };
  }
  function publicQuote(q) {
    return {
      token: q.token,
      fromPlan: q.fromPlan,
      plan: q.targetPlan,
      planName: q.planName,
      amountDueNow: q.immediateAmount,
      nextInvoiceAmount: q.nextInvoiceAmount,
      currency: q.currency,
      renewsAt: q.renewsAt,
      endsTrial: q.endsTrial,
      changesInterval: q.changesInterval,
      price: q.price,
      expires: q.expires,
      proration: 'none',
    };
  }
  async function preview(user, planId) {
    return withLock(user.id, async () => {
      sweep();
      const q = await makePreview(user, planId);
      if (!quotes.has(user.id) && quotes.size >= 1000)
        throw fail(429, 'Trop de demandes de facturation. Réessayez dans quelques instants.');
      q.token = randomBytes(24).toString('hex');
      q.expires = now() + 5 * 60000;
      quotes.set(user.id, q);
      return publicQuote(q);
    });
  }
  async function change(user, planId, token) {
    return withLock(user.id, async () => {
      sweep();
      const q = quotes.get(user.id);
      if (!q || q.token !== token || q.targetPlan !== planId)
        throw fail(409, 'Le récapitulatif a expiré. Vérifiez à nouveau le changement d’offre.');
      if (q.result) return q.result;
      const a = await account(user);
      if (a.sub?.metadata?.clair_change === token && itemFor(a.sub).price.id === q.targetPrice) {
        q.result = { updated: true, pendingPayment: await invoicePayment(a.sub) };
        return q.result;
      }
      const fresh = await makePreview(user, planId);
      const equal = [
        'customer',
        'subscription',
        'item',
        'fromPrice',
        'targetPrice',
        'immediateAmount',
        'nextInvoiceAmount',
        'currency',
        'endsTrial',
        'changesInterval',
      ].every((k) => fresh[k] === q[k]);
      if (!equal)
        throw fail(
          409,
          'La facturation a changé depuis le récapitulatif. Vérifiez à nouveau les montants.',
        );
      await stripe.subscriptions.update(
        q.subscription,
        {
          ...q.details,
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          metadata: { plan: planId, userId: user.id, clair_change: token },
          expand: ['latest_invoice.confirmation_secret'],
        },
        { idempotencyKey: 'clair-change-' + user.id + '-' + token },
      );
      const updated = await syncCustomer(q.customer);
      q.result = { updated: true, pendingPayment: await invoicePayment(updated) };
      return q.result;
    });
  }
  async function renewal(user, cancel) {
    return withLock(user.id, async () => {
      const a = await account(user),
        sub = a.sub;
      if (!sub || !['active', 'trialing'].includes(sub.status))
        throw fail(409, 'Aucun renouvellement actif à modifier.');
      itemFor(sub);
      if (Boolean(sub.cancel_at_period_end) !== cancel) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: cancel });
        await syncCustomer(a.user.customer);
      }
      return { cancelAtPeriodEnd: cancel };
    });
  }
  return { state, preview, change, renewal };
}
