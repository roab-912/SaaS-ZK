import express from 'express';
import {
  checkoutAction,
  billingCompletionAction,
  billingChangeAction,
  billingRenewalAction,
} from '../schemas.mjs';
import { fail } from '../errors.mjs';
const events = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);
// Must be registered before the JSON parser: Stripe signs the exact raw bytes.
export function registerBillingWebhook(app, { stripe, billing, config }) {
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json', limit: '1mb', inflate: false }),
    async (req, res) => {
      if (!stripe) return res.sendStatus(404);
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'],
          config.stripeWebhookSecret,
        );
      } catch {
        throw fail(400, 'Signature webhook invalide.');
      }
      if (events.has(event.type)) {
        const object = event.data.object,
          customer = typeof object.customer === 'string' ? object.customer : object.customer?.id;
        if (customer) {
          if (event.type === 'checkout.session.completed') await billing.completeWebhook(object);
          await billing.syncCustomer(customer);
        }
      }
      res.json({ received: true });
    },
  );
}
export function registerBillingRoutes(app, { sessions, stripe, billing, config, audit }) {
  const actions = {
    '/api/billing/checkout': 'billing.checkout',
    '/api/billing/payment-method': 'billing.payment_method',
    '/api/billing/change': 'billing.change',
    '/api/billing/renewal': 'billing.renewal',
  };
  app.use('/api/billing', (req, res, next) => {
    const event = actions[req.originalUrl.split('?')[0]];
    if (req.method === 'POST' && event)
      res.once('finish', () => {
        if (res.statusCode < 300) audit(event, { actorId: req.user?.id, plan: req.body?.plan });
      });
    next();
  });
  app.get('/api/billing/plans', async (req, res) => res.json(await billing.plans()));
  app.get('/api/billing/config', sessions.auth, (req, res) =>
    res.json({
      publishableKey: config.stripePublishableKey || null,
      paymentEnvironment: config.paymentEnvironment,
    }),
  );
  app.get('/api/billing/state', sessions.auth, async (req, res) =>
    res.json(await billing.state(req.user)),
  );
  app.post('/api/billing/checkout', sessions.auth, async (req, res) =>
    res.json(await billing.checkout(req.user, checkoutAction.parse(req.body).plan)),
  );
  app.post('/api/billing/payment-method', sessions.auth, async (req, res) =>
    res.json(await billing.setupPaymentMethod(req.user)),
  );
  app.post('/api/billing/complete', sessions.auth, async (req, res) =>
    res.json(await billing.complete(req.user, billingCompletionAction.parse(req.body).sessionId)),
  );
  app.post('/api/billing/change/preview', sessions.auth, async (req, res) =>
    res.json(await billing.preview(req.user, checkoutAction.parse(req.body).plan)),
  );
  app.post('/api/billing/change', sessions.auth, async (req, res) => {
    const input = billingChangeAction.parse(req.body);
    res.json(await billing.change(req.user, input.plan, input.token));
  });
  app.post('/api/billing/renewal', sessions.auth, async (req, res) =>
    res.json(await billing.renewal(req.user, billingRenewalAction.parse(req.body).cancel)),
  );
  app.post('/api/billing/sync', sessions.auth, async (req, res) => {
    if (stripe && req.user.customer) await billing.syncCustomer(req.user.customer);
    res.json({ ok: true });
  });
}
