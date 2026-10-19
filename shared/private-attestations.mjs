import { z } from 'zod';
// Fixed binary message for signatures verified inside Noir. No JSON parsing in the circuit.
export const PRIVATE_ATTESTATION_FORMAT = 'clair-attestation/2';
export const privateSignedInputs = (c) =>
  c.inputs.filter((i) => i.source === 'signed' && i.visibility === 'private');
export const decodeBytes = (s) =>
  Uint8Array.from(
    atob(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
export function privatePrefix(input) {
  const p = input.attestation ?? input;
  const pad = (s, n) => {
    const a = new Uint8Array(n);
    a.set(new TextEncoder().encode(s));
    return [...a];
  };
  return [
    ...new TextEncoder().encode('clair-private/2:'),
    ...pad(p.issuerId, 40),
    ...pad(p.claim, 64),
    ...p.keyHash.match(/../g).map((v) => parseInt(v, 16)),
    { number: 0, date: 1, boolean: 2 }[input.type],
  ];
}
export const uuidBytes = (id) =>
  id
    .replaceAll('-', '')
    .match(/../g)
    .map((v) => parseInt(v, 16));
export function privateMessage(a) {
  const v = a.type === 'date' ? Number(a.value.replaceAll('-', '')) : Number(a.value);
  const tail = new Uint8Array(4 + 16 + 16),
    view = new DataView(tail.buffer);
  view.setUint32(0, v);
  tail.set(uuidBytes(a.id), 4);
  view.setBigUint64(20, BigInt(Date.parse(a.issuedAt)));
  view.setBigUint64(28, BigInt(Date.parse(a.expiresAt)));
  return new Uint8Array([...privatePrefix(a), ...tail]);
}

export const privateStatementsSchema = z
  .array(
    z
      .object({
        inputId: z.string().regex(/^[a-z][a-z0-9_]{0,23}$/),
        issuedAt: z.string().datetime(),
        expiresAt: z.string().datetime(),
      })
      .strict(),
  )
  .max(12);
export function privateDisclosures(circuit, evidence) {
  return privateSignedInputs(circuit).map((input) => {
    const a = evidence.find((e) => e.inputId === input.id)?.attestation;
    if (!a || a.format !== PRIVATE_ATTESTATION_FORMAT)
      throw Error('Attestation privée manquante ou incompatible.');
    return { inputId: input.id, issuedAt: a.issuedAt, expiresAt: a.expiresAt };
  });
}
export function bindPrivateDisclosures(envelope) {
  const inputs = privateSignedInputs(envelope.circuit),
    rows = envelope.privateAttestations;
  if (rows.length !== inputs.length || new Set(rows.map((r) => r.inputId)).size !== rows.length)
    throw Error('Métadonnées des attestations privées incorrectes.');
  const offset = 2 + envelope.circuit.inputs.filter((i) => i.visibility === 'public').length;
  for (const [n, input] of inputs.entries()) {
    const a = rows[n];
    if (a.inputId !== input.id) throw Error('Ordre des attestations privées incorrect.');
    const issued = Date.parse(a.issuedAt),
      expires = Date.parse(a.expiresAt);
    if (
      !Number.isSafeInteger(issued) ||
      issued < 0 ||
      !Number.isSafeInteger(expires) ||
      expires <= issued ||
      BigInt(envelope.publicInputs[offset + 2 * n]) !== BigInt(issued) ||
      BigInt(envelope.publicInputs[offset + 2 * n + 1]) !== BigInt(expires)
    )
      throw Error('Dates des attestations privées différentes des paramètres prouvés.');
  }
}
