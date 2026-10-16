import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
export async function setupCircuit(directory, protocol, parameters) {
  if (!['plonk', 'fflonk'].includes(protocol)) throw Error('Unsupported protocol.');
  await promisify(execFile)(
    process.execPath,
    [require.resolve('circom2/cli.js'), 'rule.circom', '--r1cs', '--wasm', '--O1'],
    {
      cwd: directory,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  const sdk = await import('snarkjs');
  const zkey = join(directory, 'rule.zkey');
  try {
    const result = await sdk[protocol].setup(join(directory, 'rule.r1cs'), parameters, zkey);
    if (result === -1) throw Error('CIRCOM_CAPACITY');
    const vk = await sdk.zKey.exportVerificationKey(zkey);
    const artifact = {
      protocol,
      wasm: (await readFile(join(directory, 'rule_js/rule.wasm'))).toString('base64'),
      zkey: (await readFile(zkey)).toString('base64'),
      vk,
    };
    await writeFile(join(directory, 'artifact.json'), JSON.stringify(artifact));
  } finally {
    await globalThis.curve_bn128?.terminate();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await setupCircuit(process.argv[2], process.argv[3], process.argv[4]);
  } catch (error) {
    console.error(
      error.message.includes('big enough') || error.message === 'CIRCOM_CAPACITY'
        ? 'CIRCOM_CAPACITY'
        : 'CIRCOM_SETUP_FAILED',
    );
    process.exitCode = 1;
  }
}
