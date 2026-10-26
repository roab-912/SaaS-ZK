// Browser-only fixture. Production never imports this entry point.
import express from 'express';
import { startServer } from '../../server/index.mjs';
import { createApp } from '../../server/app.mjs';
import { createRepository } from '../../server/repository.mjs';
import { createSessions } from '../../server/security.mjs';
if (process.env.DB_PATH !== ':memory:' || process.env.PORT !== '3001')
  throw Error('Isolated test environment required.');
const runtime = await startServer({
  appFactory(options) {
    const instance = createApp(options),
      repo = createRepository(instance.db);
    const sessions = createSessions(repo, instance.config);
    const app = express();
    app.post('/__test__/subscription', express.json(), sessions.attach, (req, res) => {
      if (req.headers.origin !== instance.config.appUrl || !req.user) return res.sendStatus(403);
      const customer = 'cus_fixture_' + req.user.id;
      repo.setCustomer(req.user.id, customer);
      repo.updateSubscription(
        customer,
        req.body.active === false ? 'canceled' : 'active',
        Date.now() + 86400000,
        'sub_fixture_' + req.user.id,
      );
      res.json({ ok: true });
    });
    app.use(instance.app);
    return { ...instance, app };
  },
});
process.on('SIGTERM', () => runtime.close().then(() => process.exit()));
