import { fail } from './errors.mjs';
export const PLANS = Object.freeze([
  Object.freeze({
    id: 'essential',
    name: 'Clair Essentiel',
    circuits: 10,
    proofs: 100,
    generations: 100,
  }),
  Object.freeze({ id: 'pro', name: 'Clair Pro', circuits: 100, proofs: 1000, generations: 1000 }),
]);
export function planFor(id = 'essential') {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw fail(400, 'Offre inconnue.');
  return plan;
}
export function monthWindow(now = Date.now()) {
  const date = new Date(now);
  return {
    period: date.toISOString().slice(0, 7),
    resets: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}
export function priceFor(config, plan) {
  return config.stripePrices?.[plan] || (plan === 'essential' ? config.stripePrice : '') || '';
}
export function catalog(config) {
  return PLANS.map((p) => ({
    ...p,
    available: config.mode === 'demo' ? p.id === 'essential' : Boolean(priceFor(config, p.id)),
  }));
}
