import { validateInputs } from '../../shared/circuit-model.mjs';
import { contextField, ENGINE, buildProofEnvelope } from '../../shared/proof.mjs';
import { evaluateCircuit } from '../../shared/evaluate.mjs';
import { privateSignatureWitness } from './private-signatures.mjs';
export function normalizeInputs(circuit, values) {
  const normalized = validateInputs(circuit, values);
  return Object.fromEntries(
    circuit.inputs.map((input, index) => ['in_' + index, normalized[input.id]]),
  );
}
// Dependencies are injected so the adapter contract can be tested without WASM.
export function createNoirRuntime({ Noir, Backend, initialize = async () => {}, encode, decode }) {
  const options = Object.freeze({ keccakZK: true });
  return {
    id: ENGINE,
    async prove({ circuit, compiled, values, attestations = [], onProgress = () => {} }) {
      await initialize();
      let backend, witness;
      try {
        onProgress('Vérification des conditions sur votre appareil…');
        const noir = new Noir(compiled.artifact);
        ({ witness } = await noir.execute({
          context: contextField(compiled.hash),
          ...normalizeInputs(circuit, values),
          ...privateSignatureWitness(circuit, attestations),
          ...(circuit.version === 2 ? { result: evaluateCircuit(circuit, values) } : {}),
        }));
        backend = new Backend(compiled.artifact.bytecode, { threads: 1 });
        onProgress('Calcul de la preuve confidentielle…');
        const proof = await backend.generateProof(witness, options);
        onProgress('Contrôle de la preuve générée…');
        if (!(await backend.verifyProof(proof, options)))
          throw Error('La preuve générée ne passe pas la vérification.');
        return buildProofEnvelope({
          attestations,
          engine: ENGINE,
          circuit,
          circuitHash: compiled.hash,
          publicInputs: proof.publicInputs,
          proof: encode(proof.proof),
        });
      } finally {
        witness?.fill(0);
        await backend?.destroy();
      }
    },
    async verify({ envelope, compiled, onProgress = () => {} }) {
      await initialize();
      let backend;
      try {
        backend = new Backend(compiled.artifact.bytecode, { threads: 1 });
        onProgress('Vérification cryptographique locale…');
        return {
          valid: await backend.verifyProof(
            { proof: decode(envelope.proof), publicInputs: envelope.publicInputs },
            options,
          ),
        };
      } finally {
        await backend?.destroy();
      }
    },
  };
}
