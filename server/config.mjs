export function loadConfig(overrides = {}, env = process.env) {
  const production = overrides.production ?? env.NODE_ENV === 'production';
  const port = Number(overrides.port ?? env.PORT ?? 3000);
  const appUrl = overrides.appUrl ?? env.APP_URL ?? 'http://localhost:' + port;
  const origin = new URL(appUrl);
  const mode = overrides.mode ?? env.BILLING_MODE ?? 'demo';
  const host = overrides.host ?? env.HOST ?? '127.0.0.1';
  const stripeKey = env.STRIPE_SECRET_KEY || '';
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('PORT invalide.');
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw Error('APP_URL doit être une origine HTTP(S).');
  if (!['demo', 'stripe'].includes(mode)) throw Error('BILLING_MODE doit valoir demo ou stripe.');
  if (
    mode === 'demo' &&
    (production ||
      !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
      !['localhost', '127.0.0.1', '::1'].includes(host))
  )
    throw Error('Le mode demo est réservé au développement local.');
  if (production && origin.protocol !== 'https:') throw Error('HTTPS requis en production.');
  if (mode === 'stripe' && (!stripeKey || !env.STRIPE_PRICE_ID || !env.STRIPE_WEBHOOK_SECRET))
    throw Error('Configuration Stripe incomplète.');
  if (stripeKey.startsWith('sk_live_') && env.ALLOW_LIVE_PAYMENTS !== 'true')
    throw Error('Paiement réel non autorisé.');
  return Object.freeze({
    production,
    port,
    host,
    appUrl: origin.origin,
    mode,
    secure: origin.protocol === 'https:',
    dbPath: overrides.dbPath ?? env.DB_PATH ?? 'data/clair.sqlite',
    stripeKey,
    stripePrice: env.STRIPE_PRICE_ID || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    adminIds: Object.freeze(
      (env.ADMIN_USER_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    paymentEnvironment:
      mode === 'demo' ? 'demo' : stripeKey.startsWith('sk_live_') ? 'live' : 'test',
  });
}
