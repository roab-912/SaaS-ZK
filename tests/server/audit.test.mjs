import { test, expect, vi } from 'vitest';
import { createAuditLogger } from '../../server/audit.mjs';
test('security logs contain only allowed metadata and never credentials or payloads', () => {
  const logger = { info: vi.fn() },
    audit = createAuditLogger(logger, () => new Date('2026-10-30T00:00:00Z'));
  audit('issuer.update', {
    actorId: 'admin',
    targetId: 'issuer-1',
    approved: true,
    keyHash: 'a'.repeat(64),
    password: 'secret-marker',
    email: 'private@example.test',
    body: { d: 'private-key' },
    clientSecret: 'cs_secret',
    ip: '1.2.3.4',
  });
  expect(logger.info.mock.lastCall[0]).toEqual({
    event: 'security',
    action: 'issuer.update',
    time: '2026-10-30T00:00:00.000Z',
    actorId: 'admin',
    targetId: 'issuer-1',
    approved: true,
    keyHash: 'a'.repeat(64),
  });
  audit('auth.login', { actorId: 'injected\nline', plan: 'unknown' });
  expect(logger.info.mock.lastCall[0].actorId).toBeUndefined();
  audit('auth.login', { actorId: 'admin\n', keyHash: 'a'.repeat(64) + '\n' });
  expect(logger.info.mock.lastCall[0].actorId).toBeUndefined();
  expect(logger.info.mock.lastCall[0].keyHash).toBeUndefined();
  expect(() => audit('untrusted-event')).toThrow();
});
