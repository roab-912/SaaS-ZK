import express from 'express';
import Stripe from 'stripe';
import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { createRepository } from './repository.mjs';
import { createSessions, securityHeaders, sameOrigin, createLimit } from './security.mjs';
import { createCompiler } from './compiler.mjs';
import { createBilling } from './billing.mjs';
import { errorHandler } from './errors.mjs';
import { registerAuthRoutes } from './routes/auth.mjs';
import { registerBillingWebhook, registerBillingRoutes } from './routes/billing.mjs';
import { registerWorkspaceRoutes } from './routes/workspace.mjs';
import { registerIssuerRoutes } from './routes/issuers.mjs';

export function createApp(options = {}) {
  const config = loadConfig(options, options.env ?? process.env);
  const db = options.database ?? openDatabase(config.dbPath);
  const repo = createRepository(db),
    sessions = createSessions(repo, config);
  const stripe =
    config.mode === 'stripe'
      ? (options.stripeClient ??
        new Stripe(config.stripeKey, { timeout: 10000, maxNetworkRetries: 2 }))
      : null;
  const compiler = options.compiler ?? createCompiler();
  const billing = createBilling({
    stripe,
    repo,
    config,
    isActive: (user) => sessions.view(user)?.active,
  });
  const dependencies = { config, repo, sessions, stripe, compiler, billing };
  const app = express();
  app.set('env', config.production ? 'production' : 'development');
  app.disable('x-powered-by');
  app.use(securityHeaders(config));
  app.use(
    '/api',
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      res.set('X-Clair-Protocol', '3');
      next();
    },
    createLimit(120),
  );
  registerBillingWebhook(app, dependencies);
  app.use('/api', sameOrigin(config));
  app.use(express.json({ limit: '300kb' }));
  app.use('/api', sessions.attach);
  registerAuthRoutes(app, dependencies);
  registerBillingRoutes(app, dependencies);
  registerWorkspaceRoutes(app, dependencies);
  registerIssuerRoutes(app, dependencies);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));
  app.use(errorHandler(options.logger ?? console));
  return { app, db, config };
}
