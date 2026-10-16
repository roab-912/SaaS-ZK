import { validateInputs } from '../../shared/circuit-model.mjs';
import { contextField, ENGINE, PROOF_FORMAT, parseProof } from '../../shared/proof.mjs';
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
    async prove({ circuit, compiled, values, onProgress = () => {} }) {
      await initialize();
      let backend, witness;
      try {
        onProgress('Vérification des conditions sur votre appareil…');
        const noir = new Noir(compiled.artifact);
        ({ witness } = await noir.execute({
          context: contextField(compiled.hash),
          ...normalizeInputs(circuit, values),
        }));
        backend = new Backend(compiled.artifact.bytecode, { threads: 1 });
        onProgress('Calcul de la preuve confidentielle…');
        const proof = await backend.generateProof(witness, options);
        onProgress('Contrôle de la preuve générée…');
        if (!(await backend.verifyProof(proof, options)))
          throw Error('La preuve générée ne passe pas la vérification.');
        return parseProof({
          format: PROOF_FORMAT,
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
