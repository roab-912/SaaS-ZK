export function loadConfig(overrides = {}, env = process.env) {
  const production = overrides.production ?? env.NODE_ENV === 'production';
  const port = Number(overrides.port ?? env.PORT ?? 3000);
  const appUrl = overrides.appUrl ?? env.APP_URL ?? 'http://localhost:' + port;
  const origin = new URL(appUrl);
  const mode = overrides.mode ?? env.BILLING_MODE ?? 'demo';
  const host = overrides.host ?? env.HOST ?? '127.0.0.1';
  const stripeKey = env.STRIPE_SECRET_KEY || '';
  const stripePublishableKey = env.STRIPE_PUBLISHABLE_KEY || '';
  if (stripePublishableKey && !/^pk_(test|live)_[A-Za-z0-9_]+$/.test(stripePublishableKey))
    throw Error('Clé publique Stripe invalide.');
  if (
    mode === 'stripe' &&
    stripePublishableKey &&
    stripePublishableKey.startsWith('pk_live_') !== /^(sk|rk)_live_/.test(stripeKey)
  )
    throw Error('Les clés Stripe publique et secrète doivent utiliser le même environnement.');
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
  if (
    !production &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
      !['localhost', '127.0.0.1', '::1'].includes(host))
  )
    throw Error(
      'Le développement et la prévisualisation sont réservés à une écoute locale. Utilisez le mode production pour exposer le service.',
    );
  if (production && origin.protocol !== 'https:') throw Error('HTTPS requis en production.');
  const stripePrices = {
    essential: env.STRIPE_PRICE_ESSENTIAL || env.STRIPE_PRICE_ID || '',
    pro: env.STRIPE_PRICE_PRO || '',
  };
  if (stripePrices.pro && stripePrices.pro === stripePrices.essential)
    throw Error('Chaque offre doit avoir un prix Stripe distinct.');
  if (mode === 'stripe' && (!stripeKey || !stripePrices.essential || !env.STRIPE_WEBHOOK_SECRET))
    throw Error('Configuration Stripe incomplète.');
  if (/^(sk|rk)_live_/.test(stripeKey) && env.ALLOW_LIVE_PAYMENTS !== 'true')
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
    stripePublishableKey,
    stripePrice: stripePrices.essential,
    stripePrices: Object.freeze(stripePrices),
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    adminIds: Object.freeze(
      (env.ADMIN_USER_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    paymentEnvironment:
      mode === 'demo' ? 'demo' : /^(sk|rk)_live_/.test(stripeKey) ? 'live' : 'test',
  });
}
