import { test, expect, vi } from 'vitest';
import { launchProof, compileForEngine } from '../../../src/lib/zk-client.js';
vi.mock('../../../src/lib/api.js', () => ({ api: vi.fn(async () => ({ hash: 'ok' })) }));
import { api } from '../../../src/lib/api.js';
test('compilation sends only public circuit and explicit engine', async () => {
  const signal = new AbortController().signal;
  await compileForEngine({ version: 1 }, 'engine-v2', signal);
  expect(api).toHaveBeenCalledWith('/compile?engine=engine-v2', { version: 1 }, 'POST', { signal });
});
test('worker resolves progress/result and terminates exactly once', async () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() },
    progress = vi.fn();
  const task = launchProof({ mode: 'prove' }, progress, { createWorker: () => worker });
  worker.onmessage({ data: { type: 'progress', message: 'local' } });
  worker.onmessage({ data: { type: 'result', result: 42 } });
  expect(await task.promise).toBe(42);
  expect(progress).toHaveBeenCalledWith('local');
  task.cancel();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
test('cancel, timeout, crashes, malformed messages and constructor errors reject and clean up', async () => {
  vi.useFakeTimers();
  for (const kind of ['cancel', 'timeout', 'error', 'messageerror', 'invalid', 'provider']) {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() },
      task = launchProof({}, () => {}, { createWorker: () => worker, timeout: 5 }),
      rejection = expect(task.promise).rejects.toThrow();
    if (kind === 'cancel') task.cancel();
    else if (kind === 'timeout') vi.advanceTimersByTime(5);
    else if (kind === 'error') worker.onerror();
    else if (kind === 'messageerror') worker.onmessageerror();
    else
      worker.onmessage({ data: kind === 'provider' ? { type: 'error', message: 'failed' } : {} });
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  }
  const task = launchProof({}, () => {}, {
    createWorker: () => {
      throw Error('fail');
    },
  });
  await expect(task.promise).rejects.toThrow(/démarrer/);
  vi.useRealTimers();
});

test('compilation defaults to the engine stored in the circuit', async () => {
  const circuit = { version: 1, engine: 'circom223-snarkjs076-plonk-v1' };
  await compileForEngine(circuit);
  expect(api).toHaveBeenCalledWith('/compile?engine=' + circuit.engine, circuit, 'POST', {
    signal: undefined,
  });
});

test('only known stages are forwarded and cancellation ignores late progress', async () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() },
    onStage = vi.fn();
  const task = launchProof({}, () => {}, { createWorker: () => worker, onStage });
  const receive = worker.onmessage;
  receive({ data: { type: 'progress', message: 'local', stage: 'prove' } });
  receive({ data: { type: 'progress', message: 'local', stage: 'PRIVATE WITNESS' } });
  expect(onStage.mock.calls).toEqual([['prove']]);
  const rejection = expect(task.promise).rejects.toThrow();
  task.cancel();
  receive({ data: { type: 'progress', message: 'local', stage: 'verify' } });
  await rejection;
  expect(onStage).toHaveBeenCalledOnce();
});
