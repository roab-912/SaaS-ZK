import { test, expect } from 'vitest';
import { scryptSync } from 'node:crypto';
import { hashPassword, verifyPassword, needsPasswordUpgrade } from '../../server/passwords.mjs';
test('new salts differ, correct passwords work, wrong/malformed/missing ones fail', async () => {
  const a = await hashPassword('correct-password'),
    b = await hashPassword('correct-password');
  expect(needsPasswordUpgrade(a)).toBe(false);
  expect(needsPasswordUpgrade('legacy')).toBe(true);
  expect(a).not.toBe(b);
  expect(a).toMatch(/^scrypt-v2:/);
  expect(await verifyPassword('correct-password', a)).toBe(true);
  for (const stored of [a, undefined, 'corrupted', 'scrypt-v1:bad:bad'])
    expect(await verifyPassword('wrong-password', stored)).toBe(false);
});
test('existing MVP password hashes remain compatible', async () => {
  const salt = '0123456789abcdef0123456789abcdef',
    digest = scryptSync('legacy-password', salt, 64).toString('hex');
  expect(await verifyPassword('legacy-password', salt + ':' + digest)).toBe(true);
});

test('a concurrent password burst has a bounded cost and rejects excess work', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => hashPassword('burst-password-123')),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  expect(results.filter((r) => r.status === 'rejected').every((r) => r.reason.status === 429)).toBe(
    true,
  );
  expect(
    await verifyPassword('burst-password-123', results.find((r) => r.status === 'fulfilled').value),
  ).toBe(true);
});
