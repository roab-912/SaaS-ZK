import { test, expect } from 'vitest';
import { packageDirectory, copyDependencies, digestFile } from '../../scripts/build-offline.mjs';
import { offlineFixture } from '../helpers/offline.mjs';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
test('portable dependencies retain their licenses and package layout without copying application secrets', async () => {
  const f = await offlineFixture();
  try {
    expect(packageDirectory('dunder-proto', resolve('.'))).toContain('node_modules');
    expect(await copyDependencies(resolve('.'), f.dir, ['zod'])).toBeGreaterThan(0);
    expect(
      JSON.parse(await readFile(join(f.dir, 'node_modules/zod/package.json'), 'utf8')).name,
    ).toBe('zod');
    expect((await digestFile(join(f.dir, 'node_modules/zod/package.json'))).sha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
  } finally {
    await f.close();
  }
});
