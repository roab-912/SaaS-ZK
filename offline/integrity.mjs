import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const expected = [
  'data/noir-crs/bn254_g1.dat',
  'data/noir-crs/bn254_g2.dat',
  'data/zk-parameters/ppot0080-16.ptau',
];
export async function checkResources(root = resolve('.')) {
  const manifest = JSON.parse(await readFile(resolve(root, 'resources.clair'), 'utf8'));
  if (manifest.format !== 'clair-resources/1' || manifest.resources?.length !== expected.length)
    throw Error('Manifeste local invalide.');
  for (const path of expected) {
    const r = manifest.resources.find((r) => r.path === path);
    if (!r) throw Error('Paramètre public manquant.');
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of createReadStream(resolve(root, path))) {
      size += chunk.length;
      hash.update(chunk);
    }
    if (size !== r.bytes || hash.digest('hex') !== r.sha256)
      throw Error('Paramètres locaux altérés. Retéléchargez le logiciel.');
  }
}
