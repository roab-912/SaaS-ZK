import { test, expect, vi } from 'vitest';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../../server/index.mjs';
test('server startup is injectable and closes HTTP, Vite and database resources', async () => {
  const app = express(),
    db = { close: vi.fn() },
    vite = { middlewares: (req, res) => res.send('frontend'), close: vi.fn() },
    factory = vi.fn(async () => vite);
  const runtime = await startServer({
    args: [],
    env: {},
    appFactory: () => ({ app, db, config: { port: 0, host: '127.0.0.1' } }),
    viteFactory: factory,
  });
  expect(await (await fetch('http://127.0.0.1:' + runtime.server.address().port)).text()).toBe(
    'frontend',
  );
  await runtime.close();
  expect(db.close).toHaveBeenCalledOnce();
  expect(vite.close).toHaveBeenCalledOnce();
});

test('failed frontend startup still closes the database', async () => {
  const db = { close: vi.fn() };
  await expect(
    startServer({
      args: [],
      env: {},
      appFactory: () => ({ app: express(), db, config: { port: 0, host: '127.0.0.1' } }),
      viteFactory: async () => {
        throw new Error('startup failed');
      },
    }),
  ).rejects.toThrow('startup failed');
  expect(db.close).toHaveBeenCalledOnce();
});

test('frontend filesystem errors never expose server paths', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'clair-missing-build-'));
  const runtime = await startServer({
    args: ['--built'],
    env: {},
    dist,
    logger: { error: vi.fn() },
    appFactory: () => ({
      app: express(),
      db: { close: vi.fn() },
      config: { port: 0, host: '127.0.0.1' },
    }),
  });
  try {
    const response = await fetch('http://127.0.0.1:' + runtime.server.address().port);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain(dist);
    expect(body).not.toContain('ENOENT');
    expect(JSON.parse(body).error).toMatch(/^Erreur interne/);
  } finally {
    await runtime.close();
    rmSync(dist, { recursive: true });
  }
});
