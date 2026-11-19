import { z } from 'zod';
export * from './vat-originals.mjs';
export const UBL_VALIDATION_VERSION = Object.freeze({
  ubl: '2.1',
  en16931: '1.3.17',
  peppol: '3.0.21',
});
export const vatDocumentsValidationSchema = z
  .object({
    ubl: z.literal('2.1'),
    en16931: z.literal('1.3.17'),
    peppol: z.literal('3.0.21'),
  })
  .strict();
export const vatDocumentSchema = z
  .object({
    invoiceId: z.string().regex(/^[a-zA-Z0-9 ._/-]{1,80}$/),
    originalId: z.string().min(1).max(256),
    kind: z.enum(['invoice', 'credit']),
    name: z.string().min(1).max(255),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    profile: z.enum(['en16931', 'peppol-bis3']),
    content: z
      .string()
      .max(2666668)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((v) => v.length % 4 === 0),
  })
  .strict();
export const vatDocumentsSchema = z.array(vatDocumentSchema).min(1).max(500);
