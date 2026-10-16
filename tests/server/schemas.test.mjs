import { test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { credentials, demoAction, parseIssuer } from '../../server/schemas.mjs';
test('DTOs reject extra fields, normalize email and validate actual EC points', () => {
  expect(credentials.parse({ email: ' Alice@EXAMPLE.test ', password: 'a'.repeat(12) }).email).toBe(
    'alice@example.test',
  );
  expect(() => credentials.parse({ email: 'a@b.fr', password: 'short' })).toThrow();
  expect(() => demoAction.parse({ action: 'activate', status: 'active' })).toThrow();
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' }),
    jwk = publicKey.export({ format: 'jwk' });
  expect(parseIssuer({ id: 'source', name: 'Source', jwk, approved: true }).jwk).toEqual(jwk);
  expect(() =>
    parseIssuer({
      id: 'source',
      name: 'Source',
      jwk: { ...jwk, x: 'A'.repeat(43), y: 'A'.repeat(43) },
      approved: true,
    }),
  ).toThrow();
  expect(() =>
    parseIssuer({ id: 'source', name: 'Source', jwk: { ...jwk, d: 'secret' }, approved: true }),
  ).toThrow();
});
