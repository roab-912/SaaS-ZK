import { z } from 'zod';
import { circuitSchema, validateCircuit, isDate } from './circuit-schema.mjs';
export { ENGINE } from './engines.mjs';
export const PROOF_FORMAT = 'clair-proof/1';
export const contextField = (hash) => '0x' + hash.slice(0, 62);
// v1 public statement contract: context first, then declared public inputs in order.
// Engine selection is enforced by the trusted registry, not arbitrary imports.
export const proofSchema = z
  .object({
    format: z.literal(PROOF_FORMAT),
    engine: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,79}$/),
    circuit: circuitSchema,
    circuitHash: z.string().regex(/^[a-f0-9]{64}$/),
    publicInputs: z
      .array(z.string().regex(/^0x[0-9a-fA-F]{1,64}$/))
      .min(1)
      .max(13),
    proof: z
      .string()
      .min(4)
      .max(200000)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict();
export function parseProof(raw) {
  validateCircuit(raw?.circuit); // bound recursion before the recursive Zod schema
  const envelope = proofSchema.parse(raw);
  if (envelope.circuit.engine && envelope.circuit.engine !== envelope.engine)
    throw Error('Moteur du circuit incompatible avec la preuve.');
  publicValues(envelope);
  return envelope;
}
export function publicValues(envelope) {
  const c = validateCircuit(envelope.circuit),
    fields = c.inputs.filter((i) => i.visibility === 'public');
  if (!/^[a-f0-9]{64}$/.test(envelope.circuitHash)) throw Error('Empreinte invalide.');
  if (
    !Array.isArray(envelope.publicInputs) ||
    envelope.publicInputs.length !== fields.length + 1 ||
    envelope.publicInputs.some((v) => typeof v !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(v))
  )
    throw Error('Paramètres publics incorrects.');
  if (BigInt(envelope.publicInputs[0]) !== BigInt(contextField(envelope.circuitHash)))
    throw Error('Empreinte publique incorrecte.');
  return fields.map((i, n) => {
    const v = BigInt(envelope.publicInputs[n + 1]);
    if (
      v > 4294967295n ||
      (i.type === 'boolean' && v > 1n) ||
      (i.type === 'date' && !isDate(Number(v)))
    )
      throw Error('Valeur publique invalide.');
    return { ...i, value: i.type === 'boolean' ? v === 1n : Number(v) };
  });
}
