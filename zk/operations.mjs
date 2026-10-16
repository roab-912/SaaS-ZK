import { validateCircuit } from '../shared/circuit-schema.mjs';
import { circuitHash } from '../shared/circuit-model.mjs';
import { ENGINE, parseProof } from '../shared/proof.mjs';
export async function executeZkOperation(payload, registry, onProgress = () => {}) {
  if (!payload || !['prove', 'verify'].includes(payload.mode))
    throw Error('Opération ZK invalide.');
  const envelope = payload.mode === 'verify' ? parseProof(payload.envelope) : null;
  const circuit = envelope?.circuit ?? validateCircuit(payload.circuit);
  const engineId = envelope?.engine ?? payload.engine ?? ENGINE;
  const adapter = registry.get(engineId);
  const hash = await circuitHash(circuit);
  if (payload.compiled?.hash !== hash || payload.compiled.engine !== engineId)
    throw Error('Circuit compilé incorrect.');
  if (envelope && envelope.circuitHash !== hash) throw Error('Le circuit a été modifié.');
  if (envelope) return adapter.verify({ envelope, compiled: payload.compiled, onProgress });
  return adapter.prove({ circuit, values: payload.values, compiled: payload.compiled, onProgress });
}
