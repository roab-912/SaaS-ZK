import { compile, createFileManager } from '@noir-lang/noir_wasm';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize, resolve, sep } from 'node:path';
import { validateCircuit, circuitHash } from '../../shared/circuit.mjs';
import { noirSource } from './source.mjs';
import { ENGINE } from '../../shared/proof.mjs';
export async function compileNoir(raw) {
  const circuit = validateCircuit(raw),
    hash = await circuitHash(circuit);

  const dir = await mkdtemp(join(tmpdir(), 'clair-'));
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !dir.includes('clair-'))
    throw Error('Invalid temp path');
  try {
    await mkdir(join(dir, 'src'));
    await writeFile(
      join(dir, 'Nargo.toml'),
      '[package]\nname = "clair"\ntype = "bin"\nauthors = [""]\ncompiler_version = ">=1.0.0"\n[dependencies]\n',
    );
    const source = noirSource(circuit, hash);
    await writeFile(join(dir, 'src/main.nr'), source);
    const fm = createFileManager(dir);
    const readdir = fm.readdir.bind(fm);
    fm.readdir = async (...args) => (await readdir(...args)).map((p) => normalize(p));
    const { program } = await compile(
      fm,
      undefined,
      () => {},
      () => {},
    );
    const result = {
      hash,
      source,
      artifact: {
        abi: program.abi,
        bytecode: program.bytecode,
        noir_version: program.noir_version,
      },
    };
    return { ...result, engine: ENGINE };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
