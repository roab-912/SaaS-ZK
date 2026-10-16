import { test, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../../zk/operations.mjs', () => ({ executeZkOperation: state.run }));
vi.mock('../../zk/noir/browser.mjs', () => ({
  noirBrowser: { id: 'test', prove() {}, verify() {} },
}));
test('worker emits progress/results and never leaks provider diagnostics', async () => {
  const scope = { postMessage: vi.fn() };
  vi.stubGlobal('self', scope);
  await import('../../src/zk.worker.js');
  state.run.mockImplementationOnce(async (payload, registry, progress) => {
    progress('local');
    return { valid: true };
  });
  await scope.onmessage({ data: { mode: 'verify' } });
  expect(scope.postMessage.mock.calls.map((c) => c[0].type)).toEqual(['progress', 'result']);
  state.run.mockRejectedValueOnce(Error('PRIVATE WITNESS = 123456'));
  await scope.onmessage({ data: { mode: 'prove' } });
  expect(JSON.stringify(scope.postMessage.mock.calls)).not.toContain('123456');
  let release;
  state.run.mockImplementationOnce(() => new Promise((r) => (release = r)));
  const pending = scope.onmessage({ data: { mode: 'prove' } });
  await scope.onmessage({ data: { mode: 'prove' } });
  expect(scope.postMessage.mock.lastCall[0].type).toBe('error');
  release({});
  await pending;
  vi.unstubAllGlobals();
});
