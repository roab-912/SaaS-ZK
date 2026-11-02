import { Buffer } from 'buffer';
import process from 'process/browser';
const global = globalThis;
// Only the three compatibility globals required by the pinned WASM libraries.
globalThis.Buffer ??= Buffer;
globalThis.global ??= globalThis;
globalThis.process ??= process;
export { Buffer, global, process };
