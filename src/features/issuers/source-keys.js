import { publicKeySchema } from '../../../shared/attestations.mjs';
import { z } from 'zod';
import { zipSync, strToU8 } from 'fflate';

export function normalizeSourceId(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
}

export function sourceKeysArchive(keys, id) {
  const prefix = /^[a-z0-9-]{1,40}$/.test(id) ? id : 'source';
  return zipSync({
    [prefix + '.cle-privee.clair']: strToU8(JSON.stringify(keys.privateKey, null, 2)),
    [prefix + '.cle-publique.clair']: strToU8(JSON.stringify(keys.publicKey, null, 2)),
  });
}

const importedPublicKeySchema = publicKeySchema.extend({
  alg: z.literal('ES256').optional(),
  ext: z.boolean().optional(),
  key_ops: z.array(z.literal('verify')).optional(),
  use: z.literal('sig').optional(),
  kid: z.string().max(256).optional(),
});

export async function generateSourceKeys() {
  if (!globalThis.crypto?.subtle)
    throw Error('La génération de clés nécessite une page HTTPS ou localhost.');
  // This pair is exportable so the issuer can keep its signing key in a local file.
  // The existing non-exportable keys used elsewhere in the application stay unchanged.
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const exported = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = publicKeySchema.parse({
    kty: exported.kty,
    crv: exported.crv,
    x: exported.x,
    y: exported.y,
  });
  return { publicKey, privateKey: { ...publicKey, d: exported.d } };
}

export async function readSourcePublicKey(text) {
  let key;
  try {
    if (typeof text !== 'string' || text.length > 4096) throw Error();
    const imported = importedPublicKeySchema.parse(JSON.parse(text));
    await crypto.subtle.importKey('jwk', imported, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const { kty, crv, x, y } = imported;
    key = publicKeySchema.parse({ kty, crv, x, y });
  } catch {
    throw Error(
      'Utilisez uniquement une clé publique JWK P-256 valide, sans clé privée (4 Ko maximum).',
    );
  }
  return key;
}
