import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import initACVM from '@noir-lang/acvm_js';
import initNoirC from '@noir-lang/noirc_abi';
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';
import { Buffer } from 'buffer';
import { createNoirRuntime } from './runtime.mjs';
import { proveLargeVat } from './vat-500-prover.mjs';
let initialized;
export const noirBrowser = createNoirRuntime({
  Noir,
  Backend: UltraHonkBackend,
  // bb.js further limits this to the available cores, or one without shared memory.
  largeVatProverThreads: 4,
  proveLargeVat,
  initialize: () =>
    (initialized ??= Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]).catch(
      (error) => {
        initialized = undefined;
        throw error;
      },
    )),
  encode: (bytes) => Buffer.from(bytes).toString('base64'),
  decode: (value) => new Uint8Array(Buffer.from(value, 'base64')),
});
