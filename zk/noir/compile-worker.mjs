import { compile, createFileManager } from '@noir-lang/noir_wasm';
import { writeFile } from 'node:fs/promises';
import { resolve, join, normalize } from 'node:path';
import { assertCompileDirectory } from './compile-path.mjs';
import { pathToFileURL } from 'node:url';

export async function compileSource(directory) {
  const dir = assertCompileDirectory(directory),
    fm = createFileManager(dir);
  const readdir = fm.readdir.bind(fm);
  fm.readdir = async (...args) => (await readdir(...args)).map((p) => normalize(p));
  const { program } = await compile(
    fm,
    undefined,
    () => {},
    () => {},
  );
  const artifact = {
    abi: program.abi,
    bytecode: program.bytecode,
    noir_version: program.noir_version,
  };
  const serialized = JSON.stringify(artifact);
  if (Buffer.byteLength(serialized) > 32 * 1024 * 1024) throw Error('Compiled program too large.');
  await writeFile(join(dir, 'artifact.json'), serialized, { mode: 0o600 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await compileSource(process.argv[2]);
  } catch {
    process.exitCode = 1;
  }
}
