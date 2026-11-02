import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { fail } from './errors.mjs';
import { promisify } from 'node:util';
const deriveKey = promisify(scrypt);
let activeDerivations = 0;
async function derive(password, salt, length, policy) {
  if (activeDerivations >= 2)
    throw fail(429, 'Le service de connexion est occupé. Réessayez dans un instant.');
  activeDerivations++;
  try {
    return await deriveKey(password, salt, length, policy);
  } finally {
    activeDerivations--;
  }
}
const saltPattern = /^[a-f0-9]{32}$/;
const digestPattern = /^[a-f0-9]{128}$/;
const policies = {
  'scrypt-v2': { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
  'scrypt-v1': { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  legacy: { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
};
export const needsPasswordUpgrade = (stored) => !stored?.startsWith('scrypt-v2:');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex'),
    digest = await derive(password, salt, 64, policies['scrypt-v2']);
  return 'scrypt-v2:' + salt + ':' + digest.toString('hex');
}
export async function verifyPassword(password, stored) {
  const parts = (stored || '').split(':'),
    version = parts.length === 2 ? 'legacy' : parts[0];
  const [salt, hex] = version === 'legacy' ? parts : parts.slice(1);
  const valid =
    Object.hasOwn(policies, version) &&
    (version === 'legacy' ? parts.length === 2 : parts.length === 3) &&
    saltPattern.test(salt) &&
    digestPattern.test(hex);
  const digest = await derive(
    password,
    valid ? salt : '0'.repeat(32),
    64,
    valid ? policies[version] : policies['scrypt-v2'],
  );
  return (
    timingSafeEqual(digest, Buffer.from(valid ? hex : '0'.repeat(128), 'hex')) &&
    valid &&
    Boolean(stored)
  );
}
