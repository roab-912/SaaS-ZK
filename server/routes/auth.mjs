import { catalog, monthWindow, planFor } from '../plans.mjs';
import { credentials } from '../schemas.mjs';
import { hashPassword, verifyPassword, needsPasswordUpgrade } from '../passwords.mjs';
import { createLimit } from '../security.mjs';
import { fail } from '../errors.mjs';
export function registerAuthRoutes(app, { repo, sessions, config }) {
  const limit = createLimit(20, 15 * 60000);
  app.get('/api/session', (req, res) => {
    const now = Date.now(),
      window = monthWindow(now);
    res.json({
      user: sessions.view(req.user),
      billingMode: config.mode,
      paymentEnvironment: config.paymentEnvironment,
      plans: catalog(config),
      usage: req.user
        ? {
            ...repo.usage(req.user.id, window.period, now),
            limits: planFor(sessions.view(req.user).plan),
            ...window,
          }
        : null,
    });
  });
  app.post('/api/auth/register', limit, async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const digest = await hashPassword(password);
    let user;
    try {
      user = repo.createUser(email, digest);
    } catch (error) {
      if (error.errcode === 2067 || String(error.code).includes('CONSTRAINT_UNIQUE'))
        throw fail(
          409,
          'Impossible de créer ce compte. Cette adresse est peut-être déjà utilisée.',
        );
      throw error;
    }
    sessions.issue(req, res, user.id);
    res.status(201).json({ user: sessions.view(user) });
  });
  app.post('/api/auth/login', limit, async (req, res) => {
    const { email, password } = credentials.parse(req.body),
      user = repo.userByEmail(email);
    if (!(await verifyPassword(password, user?.password)) || !user)
      throw fail(401, 'Adresse ou mot de passe incorrect.');
    if (needsPasswordUpgrade(user.password))
      repo.updatePassword(user.id, user.password, await hashPassword(password));
    sessions.issue(req, res, user.id);
    res.json({ user: sessions.view(user) });
  });
  app.post('/api/auth/logout', (req, res) => {
    sessions.logout(req, res);
    res.json({ ok: true });
  });
}
