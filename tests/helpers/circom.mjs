import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { wtns } from 'snarkjs';
import { circomSource } from '../../zk/circom/source.mjs';
import { circuitHash, contextField } from '../../shared/circuit.mjs';
const require = createRequire(import.meta.url);
export async function witnessFixture(circuit) {
  const dir = await mkdtemp(join(tmpdir(), 'clair-constraints-')),
    hash = await circuitHash(circuit);
  try {
    await writeFile(join(dir, 'rule.circom'), circomSource(circuit, hash));
    await promisify(execFile)(
      process.execPath,
      [require.resolve('circom2/cli.js'), 'rule.circom', '--wasm', '--r1cs', '--O1'],
      { cwd: dir, timeout: 30000, windowsHide: true },
    );
    const wasm = new Uint8Array(await readFile(join(dir, 'rule_js/rule.wasm')));
    return {
      async calculate(inputs) {
        const witness = { type: 'mem' };
        try {
          await wtns.calculate({ context: contextField(hash), ...inputs }, wasm, witness, {
            memorySize: 0,
          });
        } finally {
          witness.data?.fill(0);
        }
      },
      close: () => rm(dir, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}
