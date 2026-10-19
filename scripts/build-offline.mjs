import { cp, readFile, writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadParameters } from '../zk/circom/parameters.mjs';
export async function digestFile(path) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest('hex'), bytes };
}
export function packageDirectory(name, parent) {
  const req = createRequire(join(parent, 'package.json'));
  for (const base of req.resolve.paths(name) ?? []) {
    const dir = join(base, name);
    try {
      const p = JSON.parse(requireFile(join(dir, 'package.json')));
      if (p.name === name) return dir;
    } catch {}
  }
  throw Error('Dépendance introuvable : ' + name);
}
import { readFileSync as requireFile } from 'node:fs';
export async function copyDependencies(root, target, names) {
  const seen = new Set(),
    allowed = join(root, 'node_modules') + sep;
  async function copy(name, parent, optional = false) {
    let dir;
    try {
      dir = packageDirectory(name, parent);
    } catch (error) {
      if (optional) return;
      throw error;
    }
    if (!dir.startsWith(allowed)) throw Error('Dépendance hors du dépôt.');
    if (seen.has(dir)) return;
    seen.add(dir);
    await cp(dir, join(target, relative(root, dir)), {
      recursive: true,
      filter: (path) =>
        !path.startsWith(join(dir, 'node_modules') + sep) && path !== join(dir, 'node_modules'),
    });
    const meta = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    for (const dep of Object.keys(meta.dependencies ?? {})) await copy(dep, dir);
    for (const dep of Object.keys(meta.optionalDependencies ?? {})) await copy(dep, dir, true);
  }
  for (const name of names) await copy(name, root);
  return seen.size;
}
export async function downloadResource(url, path, size, headers = {}) {
  const response = await fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok || !response.body) throw Error('Ressource publique indisponible.');
  let count = 0;
  const limit = new Transform({
    transform(chunk, encoding, done) {
      count += chunk.length;
      done(count > size ? Error('Ressource trop volumineuse.') : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(path));
  if (count !== size) throw Error('Taille de ressource publique incorrecte.');
}
export async function buildOffline({
  root = resolve(fileURLToPath(new URL('..', import.meta.url))),
} = {}) {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw Error('La distribution portable actuelle se construit sous Windows x64.');
  const output = join(root, 'data/offline');
  await mkdir(output, { recursive: true });
  const stage = await mkdtemp(join(output, 'build-'));
  if (!resolve(stage).startsWith(resolve(output) + sep)) throw Error('Chemin temporaire invalide.');
  const cache = join(root, 'data/offline-cache');
  await mkdir(cache, { recursive: true });
  try {
    console.log('Préparation des paramètres publics hors ligne…');
    const resources = [
      {
        path: 'data/noir-crs/bn254_g1.dat',
        file: 'bn254_g1.dat',
        size: (2 ** 21 + 1) * 64,
        url: 'https://crs.aztec.network/g1.dat',
        headers: { Range: 'bytes=0-' + ((2 ** 21 + 1) * 64 - 1) },
      },
      {
        path: 'data/noir-crs/bn254_g2.dat',
        file: 'bn254_g2.dat',
        size: 128,
        url: 'https://crs.aztec.network/g2.dat',
      },
    ];
    let previous = {};
    try {
      previous = JSON.parse(await readFile(join(cache, 'hashes.json'), 'utf8'));
    } catch {}
    const hashes = {},
      manifest = [];
    for (const r of resources) {
      const local = join(cache, r.file);
      let valid = false;
      try {
        const d = await digestFile(local);
        valid = d.bytes === r.size && d.sha256 === previous[r.file];
      } catch {}
      if (!valid) {
        console.log('Téléchargement public : ' + r.file);
        await downloadResource(r.url, local, r.size, r.headers);
      }
      const d = await digestFile(local);
      hashes[r.file] = d.sha256;
      const dest = join(stage, r.path);
      await mkdir(dirname(dest), { recursive: true });
      await cp(local, dest);
      manifest.push({ path: r.path, ...d });
    }
    await writeFile(join(cache, 'hashes.json'), JSON.stringify(hashes));
    const ptau = await loadParameters(),
      ptauDest = join(stage, 'data/zk-parameters/ppot0080-16.ptau');
    await mkdir(dirname(ptauDest), { recursive: true });
    await cp(ptau, ptauDest);
    manifest.push({ path: 'data/zk-parameters/ppot0080-16.ptau', ...(await digestFile(ptauDest)) });
    console.log('Copie du logiciel et de Node.js portable…');
    for (const folder of ['offline', 'shared', 'zk'])
      await cp(join(root, folder), join(stage, folder), { recursive: true });
    await cp(process.execPath, join(stage, 'node.exe'));
    const licence = await fetch(
      'https://raw.githubusercontent.com/nodejs/node/v' + process.versions.node + '/LICENSE',
      { signal: AbortSignal.timeout(30000), redirect: 'error' },
    );
    if (!licence.ok) throw Error('Licence de redistribution Node.js indisponible.');
    const licenseText = await licence.text();
    if (licenseText.length > 1000000) throw Error('Licence invalide.');
    await writeFile(join(stage, 'NODE-LICENSE.txt'), licenseText);
    await writeFile(
      join(stage, 'package.json'),
      JSON.stringify({ name: 'clair-offline', version: '0.1.0', private: true, type: 'module' }),
    );
    const dependencies = await copyDependencies(root, stage, [
      '@aztec/bb.js',
      '@noir-lang/noir_wasm',
      'snarkjs',
      'circom2',
      'zod',
    ]);
    await writeFile(
      join(stage, 'resources.clair'),
      JSON.stringify({ format: 'clair-resources/1', resources: manifest }, null, 2),
    );
    console.log('Création de l’archive (' + dependencies + ' dépendances embarquées)…');
    const pending = join(output, 'logiciel.next.zip');
    await promisify(execFile)('tar.exe', ['-a', '-c', '-f', pending, '-C', stage, '.'], {
      timeout: 300000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const info = {
      format: 'clair-offline-release/1',
      platform: 'win32-x64',
      nodeVersion: process.versions.node,
      builtAt: new Date().toISOString(),
      ...(await digestFile(pending)),
    };
    await rename(pending, join(output, 'logiciel.zip'));
    await writeFile(join(output, 'release.json'), JSON.stringify(info, null, 2));
    console.log('Vérificateur prêt : ' + Math.ceil(info.bytes / 1048576) + ' Mio.');
    return info;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildOffline();
