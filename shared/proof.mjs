import { VAT_PROOF_FORMAT, vatManifestSchema, vatConfigSchema } from './vat.mjs';
import { z } from 'zod';
import { assertEngineCapabilities } from './engines.mjs';
import { circuitSchema, validateCircuit, isDate } from './circuit-schema.mjs';
import { canonical } from './circuit-model.mjs';
import { evidenceSchema, signedInputs, bindEvidence } from './attestations.mjs';
import {
  privateSignedInputs,
  privateStatementsSchema,
  privateDisclosures,
  bindPrivateDisclosures,
} from './private-attestations.mjs';
export const PRIVATE_SIGNED_PROOF_FORMAT = 'clair-proof/4';
export const SIGNED_PROOF_FORMAT = 'clair-proof/3';
export { ENGINE } from './engines.mjs';
export const PROOF_FORMAT = 'clair-proof/1';
export const RESULT_PROOF_FORMAT = 'clair-proof/2';
export const contextField = (hash) => '0x' + hash.slice(0, 62);
const base = {
  engine: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,79}$/),
  circuitHash: z.string().regex(/^[a-f0-9]{64}$/),
  proof: z
    .string()
    .min(4)
    .max(200000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
};
const fields = (max) =>
  z
    .array(z.string().regex(/^0x[0-9a-fA-F]{1,64}$/))
    .min(1)
    .max(max);
const readableSchema = z
  .array(
    z
      .object({
        id: z.string().max(24),
        label: z.string().max(60),
        type: z.enum(['number', 'date', 'boolean']),
        value: z.union([
          z.number().int().min(0).max(4294967295),
          z.boolean(),
          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ]),
      })
      .strict(),
  )
  .max(12);
export const proofSchema = z.discriminatedUnion('format', [
  z
    .object({
      ...base,
      format: z.literal(VAT_PROOF_FORMAT),
      circuit: circuitSchema.extend({ version: z.literal(2), vat: vatConfigSchema }),
      publicInputs: fields(9),
      result: z.literal(true),
      publicData: readableSchema,
      vatManifest: vatManifestSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      format: z.literal(PRIVATE_SIGNED_PROOF_FORMAT),
      circuit: circuitSchema.extend({ version: z.literal(2) }),
      publicInputs: fields(38),
      result: z.boolean(),
      publicData: readableSchema,
      attestations: evidenceSchema,
      privateAttestations: privateStatementsSchema.min(1),
    })
    .strict(),
  z
    .object({
      ...base,
      format: z.literal(PROOF_FORMAT),
      circuit: circuitSchema.extend({ version: z.literal(1) }),
      publicInputs: fields(13),
    })
    .strict(),
  z
    .object({
      ...base,
      format: z.literal(RESULT_PROOF_FORMAT),
      circuit: circuitSchema.extend({ version: z.literal(2) }),
      publicInputs: fields(14),
      result: z.boolean(),
      publicData: readableSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      format: z.literal(SIGNED_PROOF_FORMAT),
      circuit: circuitSchema.extend({ version: z.literal(2) }),
      publicInputs: fields(14),
      result: z.boolean(),
      publicData: readableSchema,
      attestations: evidenceSchema.min(1),
    })
    .strict(),
]);
export function proofResult(envelope) {
  if (envelope.circuit.version === 1) return true;
  const value = envelope.publicInputs?.[1];
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value ?? '') || BigInt(value) > 1n)
    throw Error('Résultat public invalide.');
  return BigInt(value) === 1n;
}
export function publicValues(envelope) {
  const c = validateCircuit(envelope.circuit),
    fields = c.inputs.filter((i) => i.visibility === 'public'),
    offset = c.version === 2 ? 2 : 1;
  if (!/^[a-f0-9]{64}$/.test(envelope.circuitHash)) throw Error('Empreinte invalide.');
  if (
    !Array.isArray(envelope.publicInputs) ||
    envelope.publicInputs.length !==
      fields.length + offset + privateSignedInputs(c).length * 2 + (c.vat ? 2 : 0) ||
    envelope.publicInputs.some((v) => typeof v !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(v))
  )
    throw Error('Paramètres publics incorrects.');
  if (BigInt(envelope.publicInputs[0]) !== BigInt(contextField(envelope.circuitHash)))
    throw Error('Empreinte publique incorrecte.');
  if (c.version === 2) proofResult(envelope);
  if (c.vat) {
    const m = vatManifestSchema.parse(envelope.vatManifest);
    if (
      envelope.publicInputs.length !== 9 ||
      BigInt(envelope.publicInputs[7]) !== BigInt(m.commitment) ||
      BigInt(envelope.publicInputs[8]) !== BigInt(m.companyHash) ||
      BigInt(envelope.publicInputs[2]) !== BigInt(m.periodStart.replaceAll('-', '')) ||
      BigInt(envelope.publicInputs[3]) !== BigInt(m.periodEnd.replaceAll('-', '')) ||
      BigInt(envelope.publicInputs[4]) !== BigInt(m.count) ||
      m.count > c.vat.capacity
    )
      throw Error('Le relevé signé ne correspond pas aux paramètres prouvés.');
  }
  return fields.map((i, n) => {
    const v = BigInt(envelope.publicInputs[n + offset]);
    if (
      v > 4294967295n ||
      (i.type === 'boolean' && v > 1n) ||
      (i.type === 'date' && !isDate(Number(v)))
    )
      throw Error('Valeur publique invalide.');
    return { ...i, value: i.type === 'boolean' ? v === 1n : Number(v) };
  });
}
export function readablePublicValues(envelope) {
  return publicValues(envelope).map(({ id, label, type, value }) => ({
    id,
    label,
    type,
    value: type === 'date' ? String(value).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : value,
  }));
}
export function parseProof(raw) {
  validateCircuit(raw?.circuit);
  const envelope = proofSchema.parse(raw);
  assertEngineCapabilities(envelope.circuit, envelope.engine);
  if (envelope.circuit.engine && envelope.circuit.engine !== envelope.engine)
    throw Error('Moteur du circuit incompatible avec la preuve.');
  publicValues(envelope);
  if (envelope.circuit.version === 2) {
    if (envelope.result !== proofResult(envelope))
      throw Error('Le résultat lisible ne correspond pas au résultat prouvé.');
    if (canonical(envelope.publicData) !== canonical(readablePublicValues(envelope)))
      throw Error(
        'Les valeurs publiques lisibles ne correspondent pas aux paramètres de la preuve.',
      );
  }
  const privateInputs = privateSignedInputs(envelope.circuit);
  const publicSigned = signedInputs(envelope.circuit).filter((i) => i.visibility === 'public');
  const expected = envelope.circuit.vat
    ? VAT_PROOF_FORMAT
    : privateInputs.length
      ? PRIVATE_SIGNED_PROOF_FORMAT
      : publicSigned.length
        ? SIGNED_PROOF_FORMAT
        : envelope.circuit.version === 2
          ? RESULT_PROOF_FORMAT
          : PROOF_FORMAT;
  if (envelope.format !== expected)
    throw Error('Format de preuve incompatible avec les entrées signées.');
  if (publicSigned.length || privateInputs.length)
    bindEvidence(
      { ...envelope.circuit, inputs: publicSigned },
      Object.fromEntries(envelope.publicData.map((i) => [i.id, i.value])),
      envelope.attestations,
    );
  if (privateInputs.length) bindPrivateDisclosures(envelope);
  return envelope;
}
export function buildProofEnvelope(raw) {
  const hasPrivate = privateSignedInputs(raw.circuit).length > 0;
  const envelope = {
    ...raw,
    format: raw.circuit.vat
      ? VAT_PROOF_FORMAT
      : hasPrivate
        ? PRIVATE_SIGNED_PROOF_FORMAT
        : signedInputs(raw.circuit).length
          ? SIGNED_PROOF_FORMAT
          : raw.circuit.version === 2
            ? RESULT_PROOF_FORMAT
            : PROOF_FORMAT,
  };
  if (hasPrivate) {
    envelope.privateAttestations = privateDisclosures(raw.circuit, raw.attestations ?? []);
    envelope.attestations = (raw.attestations ?? []).filter(
      (e) => raw.circuit.inputs.find((i) => i.id === e.inputId)?.visibility === 'public',
    );
  }
  if (!signedInputs(raw.circuit).length) delete envelope.attestations;
  if (raw.circuit.version === 2) {
    envelope.result = proofResult(envelope);
    envelope.publicData = readablePublicValues(envelope);
  }
  return parseProof(envelope);
}
