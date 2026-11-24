import { Barretenberg, RawBuffer, deflattenFields, splitHonkProof } from '@aztec/bb.js';
import { Buffer } from 'buffer';
import { gunzipSync } from 'fflate';
import { sha256Hex } from '../../shared/ubl.mjs';
import key from './vat-500-v2-vk.json' with { type: 'json' };

// The VAT envelope carries nine public fields, including the circuit context.
const VAT_PUBLIC_FIELDS = 9;

export async function proveLargeVat(compiled, witness, threads, checking) {
  if (compiled.hash !== key.circuitHash) return null;
  const bytecode = gunzipSync(Buffer.from(compiled.artifact.bytecode, 'base64'));
  if ((await sha256Hex(bytecode)) !== key.acirSha256) return null;

  const api = await Barretenberg.new({ threads });
  try {
    await api.acirInitSRS(bytecode, false, true);
    const uncompressed = gunzipSync(witness);
    let combined;
    try {
      combined = await api.acirProveUltraKeccakZKHonk(bytecode, uncompressed);
    } finally {
      uncompressed.fill(0);
    }
    checking();
    const vk = new RawBuffer(Buffer.from(key.vkBase64, 'base64'));
    if (!(await api.acirVerifyUltraKeccakZKHonk(combined, vk)))
      throw Error('La preuve générée ne passe pas la vérification.');
    const { proof, publicInputs } = splitHonkProof(combined, VAT_PUBLIC_FIELDS);
    return { proof, publicInputs: deflattenFields(publicInputs) };
  } finally {
    await api.destroy();
  }
}
