import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'fflate';
export async function verifyUblInputs(root = resolve('.')) {
  const lock = JSON.parse(await readFile(join(root, 'vendor/ubl/assets.json'), 'utf8'));
  for (const [name, expected] of Object.entries(lock.inputs)) {
    const target = resolve(root, name);
    if (!target.startsWith(resolve(root) + sep)) throw Error('Chemin de ressource UBL interdit.');
    const bytes = await readFile(target);
    if (
      bytes.length !== expected.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== expected.sha256
    )
      throw Error('Ressource UBL modifiée : ' + name);
  }
  return lock;
}
export async function buildUblAssets({ root = resolve('.') } = {}) {
  const lock = await verifyUblInputs(root),
    output = join(root, 'public/ubl');
  await mkdir(join(root, 'data'), { recursive: true });
  const stage = await mkdtemp(join(root, 'data/ubl-build-'));
  if (!resolve(stage).startsWith(resolve(root, 'data') + sep))
    throw Error('Répertoire UBL temporaire invalide.');
  const generated = {};
  try {
    const compile = async (args) =>
      promisify(execFile)(process.execPath, [join(root, 'node_modules/xslt3/xslt3.js'), ...args], {
        cwd: root,
        windowsHide: true,
        maxBuffer: 4000000,
        timeout: 120000,
      });
    const save = async (name, bytes) => {
      const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
      await writeFile(join(output, name), compressed);
      generated[name] = {
        bytes: compressed.length,
        sha256: createHash('sha256').update(compressed).digest('hex'),
      };
    };
    const schemas = {};
    for (const p of Object.keys(lock.inputs).filter((p) => p.startsWith('public/ubl/xsd/')))
      schemas[p.slice('public/ubl/xsd/'.length)] = await readFile(join(root, p), 'utf8');
    await save('schemas-2.1.json.gz', new TextEncoder().encode(JSON.stringify(schemas)));
    await compile([
      '-xsl:vendor/ubl/EN16931-UBL-validation-1.3.17.xslt',
      '-export:' + join(stage, 'en.sef.json'),
      '-nogo',
      '-relocate:on',
    ]);
    await save('en16931-ubl-1.3.17.sef.json.gz', await readFile(join(stage, 'en.sef.json')));
    await compile([
      '-xsl:vendor/ubl/skeleton/iso_dsdl_include.xsl',
      '-s:vendor/ubl/PEPPOL-EN16931-UBL-3.0.21.sch',
      '-o:' + join(stage, 'included.sch'),
    ]);
    await compile([
      '-xsl:vendor/ubl/skeleton/iso_abstract_expand.xsl',
      '-s:' + join(stage, 'included.sch'),
      '-o:' + join(stage, 'expanded.sch'),
    ]);
    await compile([
      '-xsl:vendor/ubl/skeleton/iso_svrl_for_xslt2.xsl',
      '-s:' + join(stage, 'expanded.sch'),
      '-o:' + join(stage, 'peppol.xsl'),
    ]);
    await compile([
      '-xsl:' + join(stage, 'peppol.xsl'),
      '-export:' + join(stage, 'peppol.sef.json'),
      '-nogo',
      '-relocate:on',
    ]);
    await save('peppol-3.0.21.sef.json.gz', await readFile(join(stage, 'peppol.sef.json')));
    await writeFile(
      join(output, 'manifest.json'),
      JSON.stringify(
        {
          format: lock.format,
          ubl: lock.ubl,
          en16931: lock.en16931,
          peppol: lock.peppol,
          saxon: lock.saxon,
          generated,
        },
        null,
        2,
      ) + '\n',
    );
    return generated;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await buildUblAssets();
  console.log('Ressources UBL prêtes : ' + Object.keys(result).length + ' fichiers compressés.');
}
