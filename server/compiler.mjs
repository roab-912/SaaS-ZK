import { validateCircuit, circuitHash } from '../shared/circuit.mjs';
import { ENGINE, PLONK_ENGINE, FFLONK_ENGINE } from '../shared/engines.mjs';
import { compileCircom } from '../zk/circom/compiler.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';
import { fail, input } from './errors.mjs';
export function createCompiler({
  adapters = [
    { id: ENGINE, compile: compileNoir },
    ...[PLONK_ENGINE, FFLONK_ENGINE].map((id) => ({ id, compile: (c) => compileCircom(c, id) })),
  ],
  maxPending = 8,
  maxCache = 50,
  maxCacheBytes = 64 * 1024 * 1024,
} = {}) {
  const registry = createEngineRegistry(adapters, ['compile']);
  let cacheBytes = 0;
  const cache = new Map(),
    pending = new Map();
  let queue = Promise.resolve();
  const compile = async (raw, engine = raw?.engine ?? ENGINE) => {
    const adapter = input(() => registry.get(engine));
    const circuit = input(() => validateCircuit(raw)),
      hash = await circuitHash(circuit),
      key = engine + ':' + hash;
    if (circuit.engine && circuit.engine !== engine)
      throw fail(400, 'Moteur du circuit incompatible.');
    if (cache.has(key)) return structuredClone(cache.get(key).compiled);
    if (pending.has(key)) return structuredClone(await pending.get(key));
    if (pending.size >= maxPending)
      throw fail(503, 'Le compilateur est occupé. Réessayez plus tard.');
    const task = queue.then(async () => {
      let result;
      try {
        result = await adapter.compile(circuit);
      } catch (error) {
        if (error.code === 'CIRCOM_CAPACITY') throw fail(400, error.message);
        throw error;
      }
      if (result.hash !== hash) throw Error('Compiler returned a mismatched circuit hash.');
      const compiled = { ...result, engine };
      const bytes = Buffer.byteLength(JSON.stringify(compiled));
      while (cache.size && (cache.size >= maxCache || cacheBytes + bytes > maxCacheBytes)) {
        const oldest = cache.keys().next().value;
        cacheBytes -= cache.get(oldest).bytes;
        cache.delete(oldest);
      }
      if (maxCache > 0 && bytes <= maxCacheBytes) {
        cache.set(key, { compiled: structuredClone(compiled), bytes });
        cacheBytes += bytes;
      }
      return compiled;
    });
    pending.set(key, task);
    queue = task.catch(() => {});
    try {
      return structuredClone(await task);
    } finally {
      pending.delete(key);
    }
  };
  return { compile, engines: registry.ids() };
}
const defaultCompiler = createCompiler();
export const compileCircuit = (raw, engine) => defaultCompiler.compile(raw, engine);
