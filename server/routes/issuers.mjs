import { fail } from '../errors.mjs';
import { parseIssuer } from '../schemas.mjs';
export function registerIssuerRoutes(app, { repo, sessions }) {
  app.get('/api/issuers', (req, res) => res.json(repo.listIssuers()));
  app.post('/api/issuers', sessions.auth, (req, res) => {
    if (!sessions.view(req.user).admin) throw fail(403, 'Accès administrateur requis.');
    repo.saveIssuer(parseIssuer(req.body));
    res.json({ ok: true });
  });
}
