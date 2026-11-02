import { verifyVatDocuments } from '../shared/vat-documents.mjs';
import { parseVatBatch, verifyVatManifest } from '../shared/vat.mjs';
import { validateCircuit } from '../shared/circuit-schema.mjs';
import { circuitHash } from '../shared/circuit-model.mjs';
import { ENGINE, parseProof, readablePublicValues } from '../shared/proof.mjs';
import { signedInputs, verifyEvidence, verifyPrivateSources } from '../shared/attestations.mjs';
import { validateInputs } from '../shared/circuit-model.mjs';
import { privateSignedInputs, privateDisclosures } from '../shared/private-attestations.mjs';
import { assertEngineCapabilities } from '../shared/engines.mjs';
export async function executeZkOperation(payload, registry, onProgress = () => {}) {
  if (!payload || !['prove', 'verify'].includes(payload.mode))
    throw Error('Opération ZK invalide.');
  const envelope = payload.mode === 'verify' ? parseProof(payload.envelope) : null;
  const circuit = envelope?.circuit ?? validateCircuit(payload.circuit);
  const engineId = envelope?.engine ?? payload.engine ?? circuit.engine ?? ENGINE;
  if (circuit.engine && circuit.engine !== engineId) throw Error('Moteur du circuit incompatible.');
  assertEngineCapabilities(circuit, engineId);
  const adapter = registry.get(engineId);
  const hash = await circuitHash(circuit);
  if (payload.compiled?.hash !== hash || payload.compiled.engine !== engineId)
    throw Error('Circuit compilé incorrect.');
  if (envelope && envelope.circuitHash !== hash) throw Error('Le circuit a été modifié.');
  if (envelope) {
    const proof = await adapter.verify({ envelope, compiled: payload.compiled, onProgress });
    if (circuit.vat) {
      const source = await verifyVatManifest(envelope.vatManifest, payload.issuers);
      return { valid: proof.valid && source.valid, proofValid: proof.valid, sources: [source] };
    }
    if (!signedInputs(circuit).length) return proof;
    const values = Object.fromEntries(readablePublicValues(envelope).map((i) => [i.id, i.value]));
    const publicCircuit = {
      ...circuit,
      inputs: circuit.inputs.filter((i) => i.visibility === 'public'),
    };
    const sources = [
      ...(await verifyEvidence(publicCircuit, values, envelope.attestations, payload.issuers)),
      ...(await verifyPrivateSources(
        circuit,
        envelope.privateAttestations ?? [],
        payload.issuers,
        Date.now(),
        proof.valid,
      )),
    ];
    return {
      valid: proof.valid && sources.every((s) => s.valid),
      proofValid: proof.valid,
      sources,
    };
  }
  onProgress('Contrôle des données sur votre appareil…', 'validate');
  if (circuit.vat) {
    const batch = parseVatBatch(payload.vatBatch);
    const source = await verifyVatManifest(batch.manifest, payload.issuers);
    if (!source.valid) throw Error(source.reason);
    await verifyVatDocuments(batch);
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
    if (
      sources.some((s) => !s.valid) ||
      (privateSignedInputs(circuit).length &&
        (
          await verifyPrivateSources(
            circuit,
            privateDisclosures(circuit, payload.attestations),
            payload.issuers,
          )
        ).some((s) => !s.valid))
    )
      throw Error('Une attestation est invalide ou sa source n’est pas approuvée.');
  }
  return adapter.prove({
    circuit,
    values: payload.values,
    attestations: payload.attestations,
    ...(circuit.vat ? { vatBatch: payload.vatBatch } : {}),
    compiled: payload.compiled,
    onProgress,
  });
}
