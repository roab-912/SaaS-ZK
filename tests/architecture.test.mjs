import { test, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.(mjs|js|jsx)$/.test(e.name)
        ? [join(dir, e.name).replaceAll('\\', '/')]
        : [],
  );
}
test('every runtime source module has its own test file', () => {
  const missing = ['src', 'server', 'shared', 'zk']
    .flatMap(sources)
    .filter((file) => !existsSync('tests/' + file.replace(/\.(mjs|js|jsx)$/, '.test.$1')));
  expect(missing).toEqual([]);
});
test('domain and UI do not import provider SDKs; SQL is confined to persistence', () => {
  for (const file of ['src', 'server', 'shared', 'zk'].flatMap(sources)) {
    const code = readFileSync(file, 'utf8');
    if (!file.startsWith('zk/noir/') && !file.startsWith('zk/circom/'))
      expect(
        code.match(/(?:from\s+|import\(\s*)['"](?:@(noir-lang|aztec)\/|snarkjs|circom2)/),
        file,
      ).toBeNull();
    if (file.startsWith('shared/'))
      expect(code.match(/from\s+['"].*(?:zk\/|server\/|node:)/), file).toBeNull();
    if (
      file.startsWith('server/') &&
      !['server/database.mjs', 'server/repository.mjs'].includes(file)
    )
      expect(code.match(/\b(?:SELECT|INSERT INTO|UPDATE users|CREATE TABLE)\b/), file).toBeNull();
  }
});
