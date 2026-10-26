import express from 'express';
import { checkoutAction } from '../schemas.mjs';
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
    express.raw({ type: 'application/json', limit: '1mb' }),
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
        if (customer) await billing.syncCustomer(customer);
      }
      res.json({ received: true });
    },
  );
}
export function registerBillingRoutes(app, { sessions, stripe, billing }) {
  app.get('/api/billing/plans', async (req, res) => res.json(await billing.plans()));
  app.post('/api/billing/checkout', sessions.auth, async (req, res) =>
    res.json(await billing.checkout(req.user, checkoutAction.parse(req.body).plan)),
  );
  app.post('/api/billing/portal', sessions.auth, async (req, res) =>
    res.json(await billing.portal(req.user)),
  );
  app.post('/api/billing/sync', sessions.auth, async (req, res) => {
    if (stripe && req.user.customer) await billing.syncCustomer(req.user.customer);
    res.json({ ok: true });
  });
}
