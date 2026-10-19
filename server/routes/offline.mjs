import { offlineRelease, streamOfflineBundle } from '../offline-bundle.mjs';
import { createTrustSnapshot } from '../../shared/trust-snapshot.mjs';
import { createLimit } from '../security.mjs';
import { fail } from '../errors.mjs';
export function registerOfflineRoutes(app, { repo, config, offlineDirectory }) {
  app.get('/api/offline-verifier/status', async (req, res) =>
    res.json(await offlineRelease(offlineDirectory)),
  );
  app.get('/api/offline-verifier', createLimit(6), async (req, res) => {
    const ready = await offlineRelease(offlineDirectory);
    if (!ready.available) throw fail(503, 'Le vérificateur hors ligne est en préparation.');
    let rows = repo.listIssuers();
    if (req.query.issuer !== undefined) {
      if (typeof req.query.issuer !== 'string' || !/^[a-z0-9-]{1,40}$/.test(req.query.issuer))
        throw fail(400, 'Source invalide.');
      rows = rows.filter((i) => i.id === req.query.issuer);
      if (!rows.length) throw fail(404, 'Source approuvée introuvable.');
    }
    const snapshot = await createTrustSnapshot(rows, config.appUrl);
    await streamOfflineBundle(res, snapshot, { directory: offlineDirectory });
  });
}
