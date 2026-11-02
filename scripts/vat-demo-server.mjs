import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { createRepository } from '../server/repository.mjs';
import { hashPassword } from '../server/passwords.mjs';
import { createApp } from '../server/app.mjs';
import { startServer } from '../server/index.mjs';
import { publicKeySchema } from '../shared/attestations.mjs';
import { loadVatDemo, latestVatDemo } from './vat-demo-fixtures.mjs';

export async function startVatDemo({ directory, port = 3002 }) {
  const fixture = await loadVatDemo(directory),
    publicKey = publicKeySchema.parse(
      JSON.parse(
        await readFile(join(fixture.directory, 'source/demo-tva.cle-publique.clair'), 'utf8'),
      ),
    );
  const db = openDatabase(':memory:');
  try {
    const repo = createRepository(db);
    const admin = repo.createUser(
      fixture.config.credentials.admin.email,
      await hashPassword(fixture.config.credentials.admin.password),
    );
    const user = repo.createUser(
      fixture.config.credentials.user.email,
      await hashPassword(fixture.config.credentials.user.password),
    );
    const customer = 'cus_demo_' + user.id;
    repo.setCustomer(user.id, customer);
    repo.updateSubscription(
      customer,
      'active',
      Date.now() + 86400000,
      'sub_demo_' + user.id,
      'essential',
    );
    repo.saveIssuer({ ...fixture.config.source, jwk: publicKey, approved: true });
    const env = {
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_URL: 'http://localhost:' + port,
      DB_PATH: ':memory:',
      BILLING_MODE: 'demo',
      ADMIN_USER_IDS: admin.id,
    };
    const logger = {
      info() {},
      error(record) {
        console.error('Erreur du serveur de démonstration', record?.status ?? '');
      },
    };
    const instance = createApp({ database: db, env, logger });
    const runtime = await startServer({
      env,
      args: ['--built'],
      appFactory: () => instance,
      logger,
    });
    return { ...runtime, url: 'http://localhost:' + runtime.server.address().port };
  } catch (error) {
    try {
      db.close();
    } catch {}
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const runtime = await startVatDemo({ directory: process.argv[2] ?? (await latestVatDemo()) });
  console.log('Démonstration fictive : ' + runtime.url);
  console.log('Base en mémoire ; aucun paiement. Les identifiants figurent dans le README du kit.');
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      if (closing) return;
      closing = true;
      await runtime.close();
    });
}
