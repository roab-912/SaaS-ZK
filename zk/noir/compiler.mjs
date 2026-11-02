import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompileDirectory } from './compile-path.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateCircuit, circuitHash } from '../../shared/circuit.mjs';
import { noirSource } from './source.mjs';
import { ENGINE } from '../../shared/proof.mjs';
const execute = promisify(execFile);
export async function compileNoir(raw, { run = execute, timeoutMs = 180000 } = {}) {
  const circuit = validateCircuit(raw),
    hash = await circuitHash(circuit),
    source = noirSource(circuit, hash);
  const dir = await mkdtemp(join(tmpdir(), 'clair-noir-'));
  // Verify the cleanup target before any recursive operation.
  assertCompileDirectory(dir);
  try {
    await mkdir(join(dir, 'src'));
    await writeFile(
      join(dir, 'Nargo.toml'),
      '[package]\nname = "clair"\ntype = "bin"\nauthors = [""]\ncompiler_version = ">=1.0.0"\n[dependencies]\n',
      { mode: 0o600 },
    );
    await writeFile(join(dir, 'src/main.nr'), source, { mode: 0o600 });
    await run(
      process.execPath,
      [
        '--max-old-space-size=512',
        fileURLToPath(new URL('./compile-worker.mjs', import.meta.url)),
        dir,
      ],
      {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024,
        windowsHide: true,
        env: {
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
          TEMP: tmpdir(),
          TMP: tmpdir(),
        },
      },
    );
    const file = join(dir, 'artifact.json');
    if ((await stat(file)).size > 32 * 1024 * 1024) throw Error('Compiled program too large.');
    const artifact = JSON.parse(await readFile(file, 'utf8'));
    return { hash, source, artifact, engine: ENGINE };
  } catch (cause) {
    const error = Error('La compilation a échoué ou dépassé sa limite de ressources.', { cause });
    error.code = 'COMPILER_RESOURCE_LIMIT';
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}
