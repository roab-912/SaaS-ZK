import { validateCircuit, circuitHash } from '../shared/circuit.mjs';
import { ENGINE } from '../shared/proof.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';
import { fail, input } from './errors.mjs';
export function createCompiler({
  adapters = [{ id: ENGINE, compile: compileNoir }],
  maxPending = 8,
  maxCache = 50,
} = {}) {
  const registry = createEngineRegistry(adapters, ['compile']);
  const cache = new Map(),
    pending = new Map();
  let queue = Promise.resolve();
  const compile = async (raw, engine = ENGINE) => {
    const adapter = input(() => registry.get(engine));
    const circuit = input(() => validateCircuit(raw)),
      hash = await circuitHash(circuit),
      key = engine + ':' + hash;
    if (cache.has(key)) return structuredClone(cache.get(key));
    if (pending.has(key)) return structuredClone(await pending.get(key));
    if (pending.size >= maxPending)
      throw fail(503, 'Le compilateur est occupé. Réessayez plus tard.');
    const task = queue.then(async () => {
      const result = await adapter.compile(circuit);
      if (result.hash !== hash) throw Error('Compiler returned a mismatched circuit hash.');
      const compiled = { ...result, engine };
      if (cache.size >= maxCache) cache.delete(cache.keys().next().value);
      if (maxCache > 0) cache.set(key, structuredClone(compiled));
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
