import { z } from 'zod';
export const publicKeySchema = z
  .object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export const policySchema = z
  .object({
    issuerId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    keyHash: z.string().regex(/^[a-f0-9]{64}$/),
    claim: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  })
  .strict();
const fields = {
  format: z.literal('clair-attestation/1'),
  id: z.string().uuid(),
  issuerId: policySchema.shape.issuerId,
  keyHash: policySchema.shape.keyHash,
  claim: policySchema.shape.claim,
  type: z.enum(['number', 'date', 'boolean']),
  value: z.union([
    z.number().int().min(0).max(4294967295),
    z.boolean(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
};
const payloadSchema = z
  .object(fields)
  .strict()
  .superRefine((v, ctx) => {
    const typeOk =
      v.type === 'number'
        ? typeof v.value === 'number'
        : v.type === 'boolean'
          ? typeof v.value === 'boolean'
          : typeof v.value === 'string' &&
            v.value >= '1900-01-01' &&
            v.value <= '2199-12-31' &&
            new Date(v.value + 'T00:00:00Z').toISOString().slice(0, 10) === v.value;
    if (!typeOk)
      ctx.addIssue({ code: 'custom', message: 'Type ou date de la valeur signée invalide.' });
    if (Date.parse(v.expiresAt) <= Date.parse(v.issuedAt))
      ctx.addIssue({ code: 'custom', message: 'Expiration antérieure à l’émission.' });
  });
export const attestationSchema = z
  .object({
    ...fields,
    publicKey: publicKeySchema,
    signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();
export const evidenceSchema = z
  .array(
    z
      .object({
        inputId: z.string().regex(/^[a-z][a-z0-9_]{0,23}$/),
        attestation: attestationSchema,
      })
      .strict(),
  )
  .max(12);
const bytes = (s) => new TextEncoder().encode(s);
const hex = (b) => Array.from(new Uint8Array(b), (n) => n.toString(16).padStart(2, '0')).join('');
const encode = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
const decode = (s) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/') + '=='), (c) => c.charCodeAt(0));
export async function keyFingerprint(raw) {
  const { crv, kty, x, y } = publicKeySchema.parse(raw);
  return hex(await crypto.subtle.digest('SHA-256', bytes(JSON.stringify({ crv, kty, x, y }))));
}
export function parseAttestation(raw) {
  const a = attestationSchema.parse(raw);
  const { publicKey, signature, ...payload } = a;
  payloadSchema.parse(payload);
  return { ...payload, publicKey, signature };
}
function signingBytes(raw) {
  // Fixed field order and a versioned domain; independent of JSON property ordering in the file.
  const p = payloadSchema.parse(raw);
  return bytes(
    JSON.stringify([
      p.format,
      p.id,
      p.issuerId,
      p.keyHash,
      p.claim,
      p.type,
      p.value,
      p.issuedAt,
      p.expiresAt,
    ]),
  );
}
export async function generateSigningKey() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
    'verify',
  ]);
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicKey = publicKeySchema.parse({
    kty: exported.kty,
    crv: exported.crv,
    x: exported.x,
    y: exported.y,
  });
  return { privateKey: pair.privateKey, publicKey, keyHash: await keyFingerprint(publicKey) };
}
export async function signAttestation(payload, privateKey, publicKey) {
  const parsed = payloadSchema.parse(payload),
    key = publicKeySchema.parse(publicKey);
  if ((await keyFingerprint(key)) !== parsed.keyHash)
    throw Error('La clé publique ne correspond pas à son empreinte.');
  const signature = encode(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signingBytes(parsed)),
  );
  const a = parseAttestation({ ...parsed, publicKey: key, signature });
  if (!(await verifySignature(a)))
    throw Error('La clé privée ne correspond pas à la clé publique.');
  return a;
}
export async function verifySignature(raw) {
  try {
    const { publicKey, signature, ...payload } = parseAttestation(raw);
    if ((await keyFingerprint(publicKey)) !== payload.keyHash) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      decode(signature),
      signingBytes(payload),
    );
  } catch {
    return false;
  }
}
export const signedInputs = (circuit) => circuit.inputs.filter((i) => i.source === 'signed');
export function bindEvidence(circuit, values, raw = []) {
  const evidence = evidenceSchema.parse(raw),
    inputs = signedInputs(circuit);
  if (
    evidence.length !== inputs.length ||
    new Set(evidence.map((e) => e.inputId)).size !== evidence.length
  )
    throw Error('Une attestation est requise pour chaque entrée signée, sans doublon ni ajout.');
  return inputs.map((i) => {
    const a = parseAttestation(evidence.find((e) => e.inputId === i.id)?.attestation);
    if (
      a.issuerId !== i.attestation.issuerId ||
      a.keyHash !== i.attestation.keyHash ||
      a.claim !== i.attestation.claim ||
      a.type !== i.type ||
      a.value !== values[i.id]
    )
      throw Error(
        'L’attestation ne correspond pas à la source, au champ ou à la valeur publique de ' +
          i.label +
          '.',
      );
    return { input: i, attestation: a };
  });
}
export async function verifyEvidence(circuit, values, evidence, issuers = [], now = Date.now()) {
  const bound = bindEvidence(circuit, values, evidence);
  return Promise.all(
    bound.map(async ({ input, attestation: a }) => {
      const issuer = issuers.find((i) => i.id === a.issuerId);
      const signatureValid = await verifySignature(a);
      let approved = false;
      try {
        approved =
          !!issuer && issuer.approved !== false && (await keyFingerprint(issuer.jwk)) === a.keyHash;
      } catch {}
      const current = Date.parse(a.issuedAt) <= now && Date.parse(a.expiresAt) > now;
      return {
        inputId: input.id,
        issuerId: a.issuerId,
        issuerName: issuer?.name ?? a.issuerId,
        keyHash: a.keyHash,
        signatureValid,
        approved,
        current,
        valid: signatureValid && approved && current,
        reason: !signatureValid
          ? 'Signature invalide.'
          : !current
            ? 'Attestation expirée ou pas encore valable.'
            : !approved
              ? 'Source non approuvée, révoquée ou clé remplacée.'
              : 'Signature valide · Source approuvée',
        expiresAt: a.expiresAt,
      };
    }),
  );
}

export async function signInputValue(input, rawValue, privateJwk, now = Date.now()) {
  if (input.source !== 'signed' || input.visibility !== 'public' || !input.attestation)
    throw Error('Cette entrée ne demande pas de signature publique.');
  if (rawValue === '' || rawValue === null || rawValue === undefined)
    throw Error('Saisissez la valeur avant de la signer.');
  let value = rawValue;
  if (input.type === 'number') {
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !/^[0-9]+$/.test(value))
    )
      throw Error('La valeur doit être un entier positif.');
    value = Number(value);
    if (!Number.isInteger(value) || value < 0 || value > 4294967295)
      throw Error('La valeur doit être un entier entre 0 et 4 294 967 295.');
  } else if (input.type === 'boolean' && typeof value !== 'boolean')
    throw Error('La valeur doit être vraie ou fausse.');
  let publicKey, privateKey, raw;
  try {
    if (typeof privateJwk !== 'string' || privateJwk.length > 4096) throw Error();
    raw = JSON.parse(privateJwk);
    publicKey = publicKeySchema.parse({ kty: raw.kty, crv: raw.crv, x: raw.x, y: raw.y });
    if (typeof raw.d !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw.d)) throw Error();
  } catch {
    throw Error('Clé privée JWK P-256 invalide.');
  }
  if ((await keyFingerprint(publicKey)) !== input.attestation.keyHash)
    throw Error('Cette clé privée ne correspond pas à la source attendue.');
  try {
    privateKey = await crypto.subtle.importKey(
      'jwk',
      { ...publicKey, d: raw.d },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  } catch {
    throw Error('Clé privée JWK P-256 invalide.');
  }
  try {
    return await signAttestation(
      {
        format: 'clair-attestation/1',
        id: crypto.randomUUID(),
        issuerId: input.attestation.issuerId,
        keyHash: input.attestation.keyHash,
        claim: input.attestation.claim,
        type: input.type,
        value,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 7 * 86400000).toISOString(),
      },
      privateKey,
      publicKey,
    );
  } catch {
    throw Error('Signature impossible : vérifiez la clé privée, le type et la valeur du champ.');
  }
}
