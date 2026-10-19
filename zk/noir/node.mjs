import { UltraHonkBackend } from '@aztec/bb.js';
import { createNoirRuntime } from './runtime.mjs';
export function createNoirNode({ crsPath } = {}) {
  return createNoirRuntime({
    Backend: class extends UltraHonkBackend {
      constructor(bytecode, options) {
        super(bytecode, { ...options, crsPath });
      }
    },
    encode: (bytes) => Buffer.from(bytes).toString('base64'),
    decode: (value) => new Uint8Array(Buffer.from(value, 'base64')),
  });
}
