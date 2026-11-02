import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { assertSupportedRuntime } from './runtime-policy.mjs';
import { createApp } from './app.mjs';
import { errorHandler } from './errors.mjs';
export async function startServer({
  env = process.env,
  args = process.argv,
  appFactory = createApp,
  viteFactory,
  dist = resolve('dist'),
  logger = console,
} = {}) {
  const production = args.includes('--production') || env.NODE_ENV === 'production';
  if (production) assertSupportedRuntime(process.versions.node);
  const { app, db, config } = appFactory({ production, env });
  let vite;
  const server = createServer(app);
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  async function closeResources() {
    try {
      if (server?.listening)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    } finally {
      try {
        await vite?.close();
      } finally {
        db.close();
      }
    }
  }
  try {
    if (production || args.includes('--built')) {
      app.use(express.static(dist));
      app.get('/{*splat}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
    } else {
      const factory = viteFactory ?? (await import('vite')).createServer;
      vite = await factory({
        server: { middlewareMode: true, hmr: { server } },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
    app.use(errorHandler(logger));
    server.listen(config.port, config.host);
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    return {
      server,
      config,
      close: closeResources,
    };
  } catch (error) {
    await closeResources();
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const runtime = await startServer();
  console.log('Clair disponible sur ' + runtime.config.appUrl);
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      if (closing) return;
      closing = true;
      try {
        await runtime.close();
        process.exitCode = 0;
      } catch {
        process.exitCode = 1;
      }
    });
}
