import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn, fork } from 'node:child_process';
import { checkResources } from './integrity.mjs';
import { validateTrustSnapshot } from '../shared/trust-snapshot.mjs';
export function runVerification(proof, snapshot) {
  return new Promise((resolve, reject) => {
    // snarkjs uses its own Node worker threads and must start in a main thread.
    const worker = fork(fileURLToPath(new URL('./verify-worker.mjs', import.meta.url)), [], {
      execArgv: ['--import', new URL('./network.mjs', import.meta.url).href],
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.kill();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(
      () => finish(Error('Vérification interrompue après cinq minutes.')),
      300000,
    );
    worker.once('message', (m) => (m.error ? finish(Error(m.error)) : finish(null, m.result)));
    worker.once('error', () => finish(Error('Le moteur local a échoué.')));
    worker.once('exit', () => finish(Error('Le moteur local a été interrompu.')));
    worker.send({ proof, snapshot });
  });
}
export async function startOffline({
  trustPath = resolve('../sources.clair'),
  verify = runVerification,
  port = 0,
} = {}) {
  const snapshot = await validateTrustSnapshot(JSON.parse(await readFile(trustPath, 'utf8')));
  const token = randomBytes(32).toString('hex');
  let busy = false,
    address;
  const assets = Object.fromEntries(
    await Promise.all(
      ['index.html', 'app.js', 'style.css'].map(async (name) => [
        name,
        await readFile(new URL('./' + name, import.meta.url), 'utf8'),
      ]),
    ),
  );
  const server = createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    if (req.headers.host !== new URL(address).host)
      return send(403, { error: 'Hôte local invalide.' });
    if (req.method === 'GET') {
      const paths = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
      if (req.url === '/snapshot') return send(200, snapshot);
      const name = paths[req.url];
      if (!name) return send(404, { error: 'Introuvable.' });
      res.writeHead(200, {
        'Content-Type': name.endsWith('.js')
          ? 'text/javascript; charset=utf-8'
          : name.endsWith('.css')
            ? 'text/css; charset=utf-8'
            : 'text/html; charset=utf-8',
      });
      return res.end(assets[name].replace('__TOKEN__', token));
    }
    if (req.method !== 'POST' || req.url !== '/verify') return send(404, { error: 'Introuvable.' });
    const supplied = String(req.headers['x-clair-local-token'] ?? '');
    if (
      !/^[a-f0-9]{64}$/.test(supplied) ||
      supplied.length !== token.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)) ||
      (req.headers.origin && req.headers.origin !== address) ||
      !String(req.headers['content-type']).startsWith('application/json')
    )
      return send(403, { error: 'Requête locale non autorisée.' });
    if (busy) return send(429, { error: 'Une vérification est déjà en cours.' });
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 300000) {
          send(413, { error: 'Fichier trop volumineux (300 Ko maximum).' });
          return;
        }
        chunks.push(chunk);
      }
      const proof = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      send(200, await verify(proof, snapshot));
    } catch {
      if (!res.headersSent)
        send(400, {
          error: 'Preuve invalide ou vérification impossible avec les ressources locales.',
        });
    } finally {
      busy = false;
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  address = 'http://127.0.0.1:' + server.address().port;
  return { server, address, close: () => new Promise((r) => server.close(r)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await checkResources();
  const index = process.argv.indexOf('--trust');
  const runtime = await startOffline(
    index < 0 ? {} : { trustPath: resolve(process.argv[index + 1]) },
  );
  console.log(
    'Clair hors ligne : ' + runtime.address + '\nFermez cette fenêtre avec Ctrl+C pour arrêter.',
  );
  if (!process.argv.includes('--no-browser'))
    spawn('rundll32.exe', ['url.dll,FileProtocolHandler', runtime.address], {
      windowsHide: true,
      stdio: 'ignore',
    }).on('error', () => {});
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await runtime.close();
    });
}
