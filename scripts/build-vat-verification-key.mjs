import { UltraHonkBackend } from '@aztec/bb.js';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { vatCircuit } from '../shared/vat.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';

// Uses only the fixed public program and the public CRS. No batch is needed.
const { artifact, hash } = await compileNoir(vatCircuit(500, 2));
const acir = gunzipSync(Buffer.from(artifact.bytecode, 'base64'));
const backend = new UltraHonkBackend(artifact.bytecode, { threads: 4, crsPath: process.argv[2] });
try {
  const vk = await backend.getVerificationKey({ keccakZK: true });
  const descriptor = {
    circuitHash: hash,
    acirSha256: createHash('sha256').update(acir).digest('hex'),
    vkBase64: Buffer.from(vk).toString('base64'),
  };
  await writeFile(
    new URL('../zk/noir/vat-500-v2-vk.json', import.meta.url),
    JSON.stringify(descriptor, null, 2) + '\n',
  );
} finally {
  await backend.destroy();
}
