import { test, expect } from 'vitest';
import { checkResources } from '../../offline/integrity.mjs';
import { offlineFixture } from '../helpers/offline.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
test('altered or missing offline parameters are refused before startup', async () => {
  const f = await offlineFixture();
  try {
    const resources = [];
    for (const path of [
      'data/noir-crs/bn254_g1.dat',
      'data/noir-crs/bn254_g2.dat',
      'data/zk-parameters/ppot0080-16.ptau',
    ]) {
      const bytes = Buffer.from(path);
      await mkdir(dirname(join(f.dir, path)), { recursive: true });
      await writeFile(join(f.dir, path), bytes);
      resources.push({
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    await writeFile(
      join(f.dir, 'resources.clair'),
      JSON.stringify({ format: 'clair-resources/1', resources }),
    );
    await expect(checkResources(f.dir)).resolves.toBeUndefined();
    await writeFile(join(f.dir, resources[0].path), 'tampered');
    await expect(checkResources(f.dir)).rejects.toThrow(/altérés/);
  } finally {
    await f.close();
  }
});
