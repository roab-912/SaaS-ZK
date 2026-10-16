/**
 * Trusted, statically registered adapters. Adding an engine never allows a proof
 * file to select a module path, download code or supply a verification key.
 * Server: { id, compile(circuit): Promise<{hash, artifact, source?}> }
 * Browser: { id, prove({circuit,compiled,values,onProgress}),
 *            verify({envelope,compiled,onProgress}) }
 * Adapters own all resources and release them before resolving.
 */
export function createEngineRegistry(adapters, methods) {
  const entries = new Map();
  for (const adapter of adapters) {
    if (
      !adapter ||
      !adapter.id ||
      entries.has(adapter.id) ||
      methods.some((m) => typeof adapter[m] !== 'function')
    )
      throw Error('Invalid or duplicate ZK adapter.');
    entries.set(adapter.id, Object.freeze({ ...adapter }));
  }
  return Object.freeze({
    get(id) {
      const adapter = entries.get(id);
      if (!adapter) throw Error('Moteur ZK non pris en charge.');
      return adapter;
    },
    ids() {
      return [...entries.keys()];
    },
  });
}
