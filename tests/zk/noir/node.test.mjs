import { test, expect, vi } from 'vitest';
vi.mock('@aztec/bb.js', () => ({
  UltraHonkBackend: class {
    constructor(bytecode, options) {
      this.options = options;
    }
  },
}));
vi.mock('../../../zk/noir/runtime.mjs', () => ({ createNoirRuntime: (options) => options }));
import { createNoirNode } from '../../../zk/noir/node.mjs';
test('Node verification explicitly uses the bundled CRS and preserves byte encodings', () => {
  const options = createNoirNode({ crsPath: 'local/crs' }),
    backend = new options.Backend('code', { threads: 1 });
  expect(backend.options).toEqual({ threads: 1, crsPath: 'local/crs' });
  expect(options.decode(options.encode(new Uint8Array([1, 2, 255])))).toEqual(
    new Uint8Array([1, 2, 255]),
  );
});
