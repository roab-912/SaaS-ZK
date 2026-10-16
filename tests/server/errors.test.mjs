import { test, expect, vi } from 'vitest';
import { z } from 'zod';
import { fail, input, errorHandler } from '../../server/errors.mjs';
test('unexpected errors expose neither SQL, credentials nor stack', () => {
  const logger = { error: vi.fn() },
    res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(logger)(Error('SELECT password secret'), {}, res, vi.fn());
  expect(res.status).toHaveBeenCalledWith(500);
  expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/SELECT|secret/);
  expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/SELECT|secret/);
});
test('known errors, validation, body limits and sent headers have explicit handling', () => {
  const handle = errorHandler({ error: vi.fn() }),
    res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), json: vi.fn() },
    next = vi.fn();
  for (const [error, status] of [
    [fail(403, 'Denied'), 403],
    [z.string().safeParse(1).error, 400],
    [{ type: 'entity.too.large' }, 413],
    [{ type: 'entity.parse.failed' }, 400],
  ]) {
    handle(error, {}, res, next);
    expect(res.status.mock.lastCall[0]).toBe(status);
  }
  handle(Error('x'), {}, { headersSent: true }, next);
  expect(next).toHaveBeenCalled();
  expect(() =>
    input(() => {
      throw Error('Bad input');
    }),
  ).toThrow('Bad input');
  expect(input(() => 42)).toBe(42);
});
