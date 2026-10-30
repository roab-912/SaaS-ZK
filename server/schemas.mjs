import { z } from 'zod';
import { createPublicKey } from 'node:crypto';
import { fail } from './errors.mjs';
import { publicKeySchema } from '../shared/attestations.mjs';
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
export const checkoutAction = z
  .object({ plan: z.enum(['essential', 'pro']).default('essential') })
  .strict();
export const proofAction = z
  .object({ token: z.string().regex(/^[a-f0-9]{32}$/), complete: z.boolean() })
  .strict();
const issuerSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    name: z.string().trim().min(1).max(80),
    jwk: publicKeySchema,
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

export const billingCompletionAction = z
  .object({
    sessionId: z
      .string()
      .min(3)
      .max(255)
      .regex(/^cs_[A-Za-z0-9_]+$/)
      .optional(),
  })
  .strict();
export const billingChangeAction = z
  .object({ plan: z.enum(['essential', 'pro']), token: z.string().regex(/^[a-f0-9]{48}$/) })
  .strict();
export const billingRenewalAction = z.object({ cancel: z.boolean() }).strict();
