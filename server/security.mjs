import { randomBytes, createHash } from 'node:crypto';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fail } from './errors.mjs';
import { planFor } from './plans.mjs';
const hash = (s) => createHash('sha256').update(s).digest('hex');
export const createLimit = (limit, windowMs = 60000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  });
export function securityHeaders(config) {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    'worker-src': ["'self'", 'blob:'],
    'connect-src': ["'self'", 'https://crs.aztec.network'],
    'img-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'upgrade-insecure-requests': config.secure ? [] : null,
  };
  const workspace = helmet({
    contentSecurityPolicy: config.production ? { directives } : false,
    crossOriginEmbedderPolicy: true,
  });
  const payment = helmet({
    contentSecurityPolicy: config.production
      ? {
          directives: {
            ...directives,
            'script-src': ["'self'", 'https://js.stripe.com', 'https://*.js.stripe.com'],
            'connect-src': ["'self'", 'https://api.stripe.com', 'https://*.stripe.com'],
            'frame-src': [
              'https://js.stripe.com',
              'https://*.js.stripe.com',
              'https://hooks.stripe.com',
            ],
            'img-src': ["'self'", 'data:', 'https://*.stripe.com'],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });
  return (req, res, next) =>
    (req.path.startsWith('/abonnement/') ? payment : workspace)(req, res, next);
}
export function sameOrigin(config) {
  return (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== config.appUrl)
      return next(fail(403, 'Origine de la requête refusée.'));
    next();
  };
}
export function createSessions(repo, config, now = Date.now) {
  const view = (user) =>
    user
      ? {
          id: user.id,
          email: user.email,
          status: user.status,
          plan: planFor(user.plan).id,
          expires: user.expires,
          active:
            Boolean(user.subscription) &&
            ['active', 'trialing'].includes(user.status) &&
            user.expires > now(),
          trialActive:
            Boolean(user.subscription) && user.status === 'trialing' && user.expires > now(),
          trialEligible: !user.trial_used,
          admin: config.adminIds.includes(user.id),
        }
      : null;
  const cookies = { httpOnly: true, sameSite: 'strict', secure: config.secure, path: '/' };
  return {
    view,
    attach(req, res, next) {
      const value = req.headers.cookie
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('clair_session='))
        ?.slice(14);
      if (value && /^[a-f0-9]{64}$/.test(value)) {
        req.sessionToken = hash(value);
        req.user = repo.userForSession(req.sessionToken, now());
      }
      next();
    },
    issue(req, res, userId) {
      if (req.sessionToken) repo.deleteSession(req.sessionToken);
      const token = randomBytes(32).toString('hex'),
        maxAge = 7 * 86400000;
      repo.createSession(hash(token), userId, now() + maxAge, now());
      res.cookie('clair_session', token, { ...cookies, maxAge });
    },
    logout(req, res) {
      if (req.sessionToken) repo.deleteSession(req.sessionToken);
      res.clearCookie('clair_session', cookies);
    },
    auth: (req, res, next) =>
      req.user ? next() : next(fail(401, 'Connectez-vous pour continuer.')),
    paid: (req, res, next) =>
      view(req.user)?.active ? next() : next(fail(402, 'Un abonnement actif est nécessaire.')),
  };
}
