import { test, expect } from 'vitest';
import { offlineRelease, OFFLINE_LAUNCHER } from '../../server/offline-bundle.mjs';
import { offlineFixture } from '../helpers/offline.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
test('portable release is unavailable if archive size does not match its metadata', async () => {
  const f = await offlineFixture();
  try {
    expect((await offlineRelease(f.dir)).available).toBe(true);
    await writeFile(join(f.dir, 'logiciel.zip'), 'corrupted');
    expect((await offlineRelease(f.dir)).available).toBe(false);
    expect(OFFLINE_LAUNCHER).toContain('Expand-Archive');
    expect(OFFLINE_LAUNCHER).toContain('--import ./offline/network.mjs');
    expect(OFFLINE_LAUNCHER).not.toContain('npm');
  } finally {
    await f.close();
  }
});

test('an old archive embedding an unsupported runtime is never offered for download', async () => {
  const f = await offlineFixture();
  try {
    const { readFile } = await import('node:fs/promises');
    const file = join(f.dir, 'release.json');
    const release = JSON.parse(await readFile(file, 'utf8'));
    release.nodeVersion = '25.4.0';
    await writeFile(file, JSON.stringify(release));
    expect((await offlineRelease(f.dir)).available).toBe(false);
  } finally {
    await f.close();
  }
});
