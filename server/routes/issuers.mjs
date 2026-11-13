import { keyFingerprint } from '../../shared/attestations.mjs';
import { fail } from '../errors.mjs';
import { parseIssuer } from '../schemas.mjs';
export function registerIssuerRoutes(app, { repo, sessions, audit }) {
  app.get('/api/issuers', (req, res) => res.json(repo.listIssuers()));
  app.get('/api/admin/issuers', sessions.auth, (req, res) => {
    if (!sessions.view(req.user).admin) throw fail(403, 'Accès administrateur requis.');
    res.json(repo.listIssuers({ includeRevoked: true }));
  });
  app.post('/api/issuers', sessions.auth, async (req, res) => {
    if (!sessions.view(req.user).admin) throw fail(403, 'Accès administrateur requis.');
    const issuer = parseIssuer(req.body);
    const keyHash = await keyFingerprint(issuer.jwk);
    repo.saveIssuer(issuer);
    audit('issuer.update', {
      actorId: req.user.id,
      targetId: issuer.id,
      approved: issuer.approved,
      keyHash,
    });
    res.json({ ok: true });
  });
}
