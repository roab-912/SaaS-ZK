import { fail } from '../errors.mjs';
import { PLANS, monthWindow } from '../plans.mjs';
export function registerAdminRoutes(app, { repo, sessions, config }) {
  app.get('/api/admin/dashboard', sessions.auth, (req, res) => {
    if (!config.adminIds.includes(req.user.id)) throw fail(403, 'Accès administrateur requis.');
    const now = Date.now(),
      window = monthWindow(now);
    res.json({
      ...repo.adminStats(now, window.period),
      plans: PLANS,
      period: window.period,
      paymentEnvironment: config.paymentEnvironment,
    });
  });
}
