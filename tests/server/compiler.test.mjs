import { test, expect, vi } from 'vitest';
import { createCompiler } from '../../server/compiler.mjs';
import { template, circuitHash } from '../../shared/circuit.mjs';
test('deduplicates, clones cached results, bounds queue and dispatches by engine', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const compile = vi.fn(async (circuit) => {
    await gate;
    return { hash: await circuitHash(circuit), artifact: { code: 'x' } };
  });
  const service = createCompiler({
    adapters: [{ id: 'test-engine', compile }],
    maxPending: 1,
    maxCache: 1,
  });
  const c = template(),
    first = service.compile(c, 'test-engine'),
    same = service.compile(c, 'test-engine');
  await vi.waitFor(() => expect(compile).toHaveBeenCalledTimes(1));
  await expect(service.compile(template('income'), 'test-engine')).rejects.toMatchObject({
    status: 503,
  });
  release();
  const [a, b] = await Promise.all([first, same]);
  expect(a).toEqual(b);
  a.artifact.code = 'tampered';
  expect((await service.compile(c, 'test-engine')).artifact.code).toBe('x');
  await expect(service.compile(c, 'unknown')).rejects.toMatchObject({ status: 400 });
  await service.compile(template('income'), 'test-engine');
  await service.compile(c, 'test-engine');
  expect(compile).toHaveBeenCalledTimes(3);
});
test('failed compiles release queue and cannot poison hash cache', async () => {
  const compile = vi
    .fn()
    .mockRejectedValueOnce(Error('failed'))
    .mockResolvedValueOnce({ hash: 'wrong' });
  const service = createCompiler({ adapters: [{ id: 'test', compile }] });
  await expect(service.compile(template(), 'test')).rejects.toThrow('failed');
  await expect(service.compile(template(), 'test')).rejects.toThrow(/mismatched/);
});
