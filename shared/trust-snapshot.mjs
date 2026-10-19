import { z } from 'zod';
import { publicKeySchema, keyFingerprint, policySchema } from './attestations.mjs';
export const trustSnapshotSchema = z
  .object({
    format: z.literal('clair-trust/1'),
    exportedAt: z.string().datetime(),
    origin: z.string().url(),
    issuers: z
      .array(
        z
          .object({
            id: policySchema.shape.issuerId,
            name: z.string().min(1).max(80),
            jwk: publicKeySchema,
            keyHash: policySchema.shape.keyHash,
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export async function createTrustSnapshot(rows, origin, now = Date.now()) {
  return validateTrustSnapshot({
    format: 'clair-trust/1',
    exportedAt: new Date(now).toISOString(),
    origin,
    issuers: await Promise.all(
      rows
        .filter((i) => i.approved !== false)
        .map(async (i) => ({
          id: i.id,
          name: i.name,
          jwk: publicKeySchema.parse(i.jwk),
          keyHash: await keyFingerprint(i.jwk),
        })),
    ),
  });
}
export async function validateTrustSnapshot(raw) {
  const s = trustSnapshotSchema.parse(raw);
  if (new Set(s.issuers.map((i) => i.id)).size !== s.issuers.length)
    throw Error('Sources dupliquées.');
  for (const i of s.issuers)
    if ((await keyFingerprint(i.jwk)) !== i.keyHash)
      throw Error('Empreinte de clé du registre incorrecte.');
  return s;
}
