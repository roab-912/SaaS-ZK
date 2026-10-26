import { test, expect, vi } from 'vitest';
import { createSessions, sameOrigin } from '../../server/security.mjs';
import { loadConfig } from '../../server/config.mjs';
test('sessions rotate tokens, hide secrets and enforce expiry/admin IDs', () => {
  const repo = {
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    userForSession: vi.fn(() => ({ id: 'u' })),
  };
  const sessions = createSessions(repo, { ...loadConfig({}, {}), adminIds: ['u'] }, () => 100);
  const res = { cookie: vi.fn(), clearCookie: vi.fn() },
    next = vi.fn();
  sessions.issue({ sessionToken: 'old' }, res, 'u');
  expect(repo.deleteSession).toHaveBeenCalledWith('old');
  const [name, token, options] = res.cookie.mock.calls[0];
  expect(name).toBe('clair_session');
  expect(token).toHaveLength(64);
  expect(options.httpOnly).toBe(true);
  expect(repo.createSession.mock.calls[0][0]).not.toBe(token);
  const req = { headers: { cookie: 'x=1; clair_session=' + token } };
  sessions.attach(req, res, next);
  expect(req.user.id).toBe('u');
  expect(
    sessions.view({
      id: 'u',
      email: 'a',
      password: 'secret',
      subscription: 'sub',
      status: 'active',
      expires: 101,
    }),
  ).toEqual({
    id: 'u',
    email: 'a',
    status: 'active',
    plan: 'essential',
    expires: 101,
    active: true,
    trialActive: false,
    trialEligible: true,
    admin: true,
  });
  expect(sessions.view({ id: 'u', status: 'active', expires: 100 }).active).toBe(false);
  expect(sessions.view(null)).toBeNull();
  sessions.auth({}, res, next);
  expect(next.mock.lastCall[0].status).toBe(401);
  sessions.paid({ user: { expires: 1 } }, res, next);
  expect(next.mock.lastCall[0].status).toBe(402);
  sessions.logout(req, res);
  expect(res.clearCookie).toHaveBeenCalled();
});
test('mutations require the exact trusted origin, reads remain public', () => {
  const check = sameOrigin({ appUrl: 'http://localhost:3000' }),
    next = vi.fn();
  check({ method: 'POST', headers: { origin: 'https://evil.test' } }, {}, next);
  expect(next.mock.lastCall[0].status).toBe(403);
  check({ method: 'GET', headers: {} }, {}, next);
  expect(next.mock.lastCall).toEqual([]);
});
