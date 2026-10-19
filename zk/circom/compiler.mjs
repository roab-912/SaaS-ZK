import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateCircuit } from '../../shared/circuit-schema.mjs';
import { circuitHash } from '../../shared/circuit-model.mjs';
import { PLONK_ENGINE, FFLONK_ENGINE, assertEngineCapabilities } from '../../shared/engines.mjs';
import { circomSource } from './source.mjs';
import { loadParameters } from './parameters.mjs';
const protocols = new Map([
  [PLONK_ENGINE, 'plonk'],
  [FFLONK_ENGINE, 'fflonk'],
]);
export async function compileCircom(raw, engine) {
  const protocol = protocols.get(engine);
  if (!protocol) throw Error('Moteur Circom inconnu.');
  const circuit = validateCircuit(raw),
    hash = await circuitHash(circuit);
  assertEngineCapabilities(circuit, engine);
  const source = circomSource(circuit, hash);
  const parameters = await loadParameters();
  const directory = await mkdtemp(join(tmpdir(), 'clair-circom-'));
  try {
    await writeFile(join(directory, 'rule.circom'), source);
    await promisify(execFile)(
      process.execPath,
      [
        '--max-old-space-size=1024',
        fileURLToPath(new URL('./setup.mjs', import.meta.url)),
        directory,
        protocol,
        parameters,
      ],
      {
        timeout: 180000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: {
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
          TEMP: tmpdir(),
          TMP: tmpdir(),
        },
      },
    );
    const file = join(directory, 'artifact.json');
    if ((await stat(file)).size > 48 * 1024 * 1024) throw Error('Circuit trop volumineux.');
    const artifact = JSON.parse(await readFile(file, 'utf8'));
    return { hash, engine, source, artifact };
  } catch (error) {
    if (error.stderr?.includes('CIRCOM_CAPACITY')) {
      const capacity = new Error(
        'Circuit trop complexe pour ce moteur. Réduisez la règle ou choisissez Noir / UltraHonk.',
      );
      capacity.code = 'CIRCOM_CAPACITY';
      throw capacity;
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
