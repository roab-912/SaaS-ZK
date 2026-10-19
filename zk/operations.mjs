import { validateCircuit } from '../shared/circuit-schema.mjs';
import { circuitHash } from '../shared/circuit-model.mjs';
import { ENGINE, parseProof, readablePublicValues } from '../shared/proof.mjs';
import { signedInputs, verifyEvidence } from '../shared/attestations.mjs';
import { validateInputs } from '../shared/circuit-model.mjs';
export async function executeZkOperation(payload, registry, onProgress = () => {}) {
  if (!payload || !['prove', 'verify'].includes(payload.mode))
    throw Error('Opération ZK invalide.');
  const envelope = payload.mode === 'verify' ? parseProof(payload.envelope) : null;
  const circuit = envelope?.circuit ?? validateCircuit(payload.circuit);
  const engineId = envelope?.engine ?? payload.engine ?? circuit.engine ?? ENGINE;
  if (circuit.engine && circuit.engine !== engineId) throw Error('Moteur du circuit incompatible.');
  const adapter = registry.get(engineId);
  const hash = await circuitHash(circuit);
  if (payload.compiled?.hash !== hash || payload.compiled.engine !== engineId)
    throw Error('Circuit compilé incorrect.');
  if (envelope && envelope.circuitHash !== hash) throw Error('Le circuit a été modifié.');
  if (envelope) {
    const proof = await adapter.verify({ envelope, compiled: payload.compiled, onProgress });
    if (!signedInputs(circuit).length) return proof;
    const values = Object.fromEntries(readablePublicValues(envelope).map((i) => [i.id, i.value]));
    const sources = await verifyEvidence(circuit, values, envelope.attestations, payload.issuers);
    return {
      valid: proof.valid && sources.every((s) => s.valid),
      proofValid: proof.valid,
      sources,
    };
  }
  if (signedInputs(circuit).length) {
    const normalized = validateInputs(circuit, payload.values);
    const values = Object.fromEntries(
      signedInputs(circuit).map((i) => [
        i.id,
        i.type === 'date'
          ? String(normalized[i.id]).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          : i.type === 'number'
            ? Number(normalized[i.id])
            : normalized[i.id],
      ]),
    );
    const sources = await verifyEvidence(circuit, values, payload.attestations, payload.issuers);
    if (sources.some((s) => !s.valid))
      throw Error('Une attestation est invalide ou sa source n’est pas approuvée.');
  }
  return adapter.prove({
    circuit,
    values: payload.values,
    attestations: payload.attestations,
    compiled: payload.compiled,
    onProgress,
  });
}
