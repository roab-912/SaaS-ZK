import { test, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acvm: vi.fn(async () => {}), abi: vi.fn(async () => {}) }));
vi.mock('@noir-lang/noir_js', () => ({ Noir: class {} }));
vi.mock('@aztec/bb.js', () => ({ UltraHonkBackend: class {} }));
vi.mock('@noir-lang/acvm_js', () => ({ default: mocks.acvm }));
vi.mock('@noir-lang/noirc_abi', () => ({ default: mocks.abi }));
vi.mock('../../../zk/noir/runtime.mjs', () => ({ createNoirRuntime: (options) => options }));
test('browser adapter initializes once and provides byte serialization', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response()),
  );
  const { noirBrowser } = await import('../../../zk/noir/browser.mjs');
  await Promise.all([noirBrowser.initialize(), noirBrowser.initialize()]);
  expect(mocks.acvm).toHaveBeenCalledOnce();
  expect(mocks.abi).toHaveBeenCalledOnce();
  expect(noirBrowser.decode(noirBrowser.encode(new Uint8Array([1, 2, 3])))).toEqual(
    new Uint8Array([1, 2, 3]),
  );
  vi.unstubAllGlobals();
});
