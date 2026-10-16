import { Buffer } from 'buffer';
import { PLONK_ENGINE, FFLONK_ENGINE } from '../../shared/engines.mjs';
import { createCircomRuntime } from './runtime.mjs';
const dependencies = {
  loadSdk: () => import('snarkjs'),
  encode: (bytes) => Buffer.from(bytes).toString('base64'),
  decode: (value) => new Uint8Array(Buffer.from(value, 'base64')),
  dispose: async () => {
    await globalThis.curve_bn128?.terminate();
  },
};
export const circomBrowsers = [
  createCircomRuntime({ ...dependencies, id: PLONK_ENGINE, protocol: 'plonk' }),
  createCircomRuntime({ ...dependencies, id: FFLONK_ENGINE, protocol: 'fflonk' }),
];
