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
