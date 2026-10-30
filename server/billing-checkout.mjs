import { fail } from './errors.mjs';
import { planFor, priceFor } from './plans.mjs';

const idOf = (value) => (typeof value === 'string' ? value : value?.id);
export function createBillingCheckout({ stripe, repo, config, syncCustomer, isActive, withLock }) {
  function requirePayment() {
    if (!stripe) throw fail(400, 'Le paiement n’est pas configuré.');
    if (!config.stripePublishableKey)
      throw fail(
        503,
        'La clé publique Stripe doit être configurée pour afficher le paiement intégré.',
      );
  }
  function result(session, extra = {}) {
    if (!session.client_secret) throw fail(502, 'Le formulaire de paiement est indisponible.');
    return {
      clientSecret: session.client_secret,
      sessionId: session.id,
      mode: session.mode,
      ...extra,
    };
  }
  async function prepare(user, purpose, planId) {
    requirePayment();
    if (purpose === 'subscription') planFor(planId);
    return withLock(user.id, async () => {
      let fresh = repo.userById(user.id),
        customer = fresh.customer;
      if (!customer) {
        if (purpose !== 'subscription') throw fail(400, 'Aucun abonnement à gérer.');
        customer = (
          await stripe.customers.create(
            { email: fresh.email, metadata: { userId: user.id } },
            { idempotencyKey: 'clair-customer-' + user.id },
          )
        ).id;
        repo.setCustomer(user.id, customer);
      }
      await syncCustomer(customer);
      fresh = repo.userById(user.id);
      if (
        purpose === 'subscription' &&
        (isActive(fresh) ||
          (fresh.subscription &&
            !['canceled', 'incomplete_expired', 'inactive'].includes(fresh.status)))
      )
        throw fail(409, 'Un abonnement existe déjà. Gérez-le depuis Mon abonnement.');
      if (
        purpose === 'payment_method' &&
        (!fresh.subscription ||
          ['canceled', 'incomplete_expired', 'inactive'].includes(fresh.status))
      )
        throw fail(400, 'Aucun abonnement à gérer.');
      const price = purpose === 'subscription' ? priceFor(config, planId) : null;
      if (purpose === 'subscription' && !price)
        throw fail(400, 'Cette offre n’est pas disponible au paiement.');
      const trial = purpose === 'subscription' && !fresh.trial_used;
      const prior = repo.getCheckout(user.id);
      if (prior) {
        const existing = await stripe.checkout.sessions.retrieve(prior);
        if (idOf(existing.customer) && idOf(existing.customer) !== customer)
          throw fail(403, 'Session de paiement incompatible avec ce compte.');
        if (existing.status === 'open') {
          if (
            existing.client_secret &&
            ['custom', 'elements'].includes(existing.ui_mode) &&
            existing.metadata?.purpose === purpose &&
            existing.metadata?.userId === user.id &&
            (purpose === 'subscription'
              ? existing.metadata?.plan === planId &&
                existing.metadata?.trial === (trial ? '30' : '0')
              : existing.metadata?.subscription === fresh.subscription)
          )
            return result(existing, { plan: planId, trialDays: trial ? 30 : 0 });
          await stripe.checkout.sessions.expire(prior);
        }
      }
      const checkout = await stripe.checkout.sessions.create(
        {
          mode: purpose === 'subscription' ? 'subscription' : 'setup',
          ui_mode: 'custom',
          customer,
          payment_method_types: ['card'],
          metadata: {
            purpose,
            userId: user.id,
            ...(purpose === 'subscription'
              ? { plan: planId, trial: trial ? '30' : '0' }
              : { subscription: fresh.subscription }),
          },
          ...(purpose === 'subscription'
            ? {
                line_items: [{ price, quantity: 1 }],
                payment_method_collection: 'always',
                subscription_data: {
                  metadata: { plan: planId, userId: user.id },
                  ...(trial
                    ? {
                        trial_period_days: 30,
                        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
                      }
                    : {}),
                },
              }
            : { setup_intent_data: { metadata: { userId: user.id, purpose } } }),
          return_url: config.appUrl + '/abonnement/retour?session_id={CHECKOUT_SESSION_ID}',
          client_reference_id: user.id,
        },
        {
          idempotencyKey: [
            'clair-elements',
            purpose,
            user.id,
            planId || 'card',
            prior || 'first',
            trial ? 'trial' : 'paid',
          ].join('-'),
        },
      );
      repo.setCheckout(user.id, checkout.id);
      return result(checkout, { plan: planId, trialDays: trial ? 30 : 0 });
    });
  }
  async function applySetup(session, fresh) {
    if (session.mode !== 'setup' || session.metadata?.purpose !== 'payment_method') return;
    if (session.metadata?.subscription !== fresh.subscription)
      throw fail(
        409,
        'L’abonnement a changé. Rechargez la page avant de modifier le moyen de paiement.',
      );
    const intent = await stripe.setupIntents.retrieve(idOf(session.setup_intent));
    if (
      intent.status !== 'succeeded' ||
      idOf(intent.customer) !== fresh.customer ||
      !intent.payment_method
    )
      throw fail(409, 'Le moyen de paiement n’est pas encore confirmé.');
    const paymentMethod = idOf(intent.payment_method);
    const method = await stripe.paymentMethods.retrieve(paymentMethod);
    if (idOf(method.customer) !== fresh.customer || method.type !== 'card')
      throw fail(403, 'Moyen de paiement incompatible avec ce compte.');
    const sub = await stripe.subscriptions.retrieve(fresh.subscription);
    if (idOf(sub.customer) !== fresh.customer)
      throw fail(403, 'Abonnement incompatible avec ce compte.');
    await stripe.customers.update(
      fresh.customer,
      { invoice_settings: { default_payment_method: paymentMethod } },
      { idempotencyKey: 'clair-card-customer-' + session.id },
    );
    await stripe.subscriptions.update(
      fresh.subscription,
      { default_payment_method: paymentMethod },
      { idempotencyKey: 'clair-card-subscription-' + session.id },
    );
  }
  async function complete(user, sessionId) {
    requirePayment();
    return withLock(user.id, async () => {
      const fresh = repo.userById(user.id),
        saved = repo.getCheckout(user.id);
      if (!fresh?.customer || !saved || (sessionId && sessionId !== saved))
        throw fail(404, 'Session de paiement introuvable pour ce compte.');
      const session = await stripe.checkout.sessions.retrieve(saved);
      if (idOf(session.customer) !== fresh.customer || session.metadata?.userId !== user.id)
        throw fail(403, 'Session de paiement incompatible avec ce compte.');
      if (session.status === 'complete') await applySetup(session, fresh);
      await syncCustomer(fresh.customer);
      return { status: session.status, mode: session.mode };
    });
  }
  return {
    checkout: (user, plan = 'essential') => prepare(user, 'subscription', plan),
    setupPaymentMethod: (user) => prepare(user, 'payment_method'),
    complete,
    async completeWebhook(session) {
      if (
        session.mode !== 'setup' ||
        session.metadata?.purpose !== 'payment_method' ||
        !session.metadata?.userId
      )
        return;
      const user = repo.userById(session.metadata.userId);
      if (
        !user ||
        user.customer !== idOf(session.customer) ||
        repo.getCheckout(user.id) !== session.id
      )
        return;
      await complete(user, session.id);
    },
  };
}
