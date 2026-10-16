import { z } from 'zod';
import { createPublicKey } from 'node:crypto';
import { fail } from './errors.mjs';
export const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const demoAction = z.object({ action: z.enum(['activate', 'cancel']) }).strict();
const issuerSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    name: z.string().trim().min(1).max(80),
    jwk: z
      .object({
        kty: z.literal('EC'),
        crv: z.literal('P-256'),
        x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      })
      .strict(),
    approved: z.boolean(),
  })
  .strict();
export function parseIssuer(raw) {
  const issuer = issuerSchema.parse(raw);
  try {
    createPublicKey({ key: issuer.jwk, format: 'jwk' });
  } catch {
    throw fail(400, 'Clé publique P-256 invalide.');
  }
  return issuer;
}
