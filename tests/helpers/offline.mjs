import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
export async function offlineFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'clair-offline-test-'));
  const bytes = Buffer.from('fake public software archive');
  await writeFile(join(dir, 'logiciel.zip'), bytes);
  await writeFile(
    join(dir, 'release.json'),
    JSON.stringify({
      format: 'clair-offline-release/1',
      platform: 'win32-x64',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
  );
  return {
    dir,
    close: async () => {
      if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !dir.includes('clair-offline-test-'))
        throw Error('Unsafe temp path');
      await rm(dir, { recursive: true, force: true });
    },
  };
}
