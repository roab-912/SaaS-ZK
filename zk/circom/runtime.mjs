import { validateInputs } from '../../shared/circuit-model.mjs';
import { contextField, buildProofEnvelope } from '../../shared/proof.mjs';
import { evaluateCircuit } from '../../shared/evaluate.mjs';
export function createCircomRuntime({
  id,
  protocol,
  loadSdk,
  encode,
  decode,
  dispose = async () => {},
}) {
  const logger = { info() {}, debug() {}, warn() {}, error() {} };
  const checkArtifact = (compiled) => {
    if (compiled.artifact?.protocol !== protocol || compiled.artifact.vk?.protocol !== protocol)
      throw Error('Paramètres du moteur incompatibles.');
  };
  return {
    id,
    async prove({ circuit, compiled, values, attestations = [], onProgress = () => {} }) {
      checkArtifact(compiled);
      const normalized = validateInputs(circuit, values);
      const inputs = { context: contextField(compiled.hash) };
      if (circuit.version === 2) inputs.result = evaluateCircuit(circuit, values) ? '1' : '0';
      circuit.inputs.forEach((input, i) => {
        inputs['in_' + i] = normalized[input.id];
      });
      const witness = { type: 'mem' };
      try {
        const sdk = await loadSdk();
        onProgress('Vérification des conditions sur votre appareil…');
        await sdk.wtns.calculate(inputs, decode(compiled.artifact.wasm), witness, {
          memorySize: 0,
        });
        onProgress('Calcul de la preuve confidentielle…');
        const result = await sdk[protocol].prove(decode(compiled.artifact.zkey), witness, logger, {
          singleThread: true,
        });
        onProgress('Contrôle de la preuve générée…');
        if (
          !(await sdk[protocol].verify(
            compiled.artifact.vk,
            result.publicSignals,
            result.proof,
            logger,
          ))
        )
          throw Error('Preuve incorrecte.');
        return buildProofEnvelope({
          attestations,
          engine: id,
          circuit,
          circuitHash: compiled.hash,
          publicInputs: result.publicSignals.map((value) => '0x' + BigInt(value).toString(16)),
          proof: encode(new TextEncoder().encode(JSON.stringify(result.proof))),
        });
      } finally {
        witness.data?.fill(0);
        for (const key of Object.keys(inputs)) delete inputs[key];
        await dispose();
      }
    },
    async verify({ envelope, compiled, onProgress = () => {} }) {
      checkArtifact(compiled);
      try {
        const proof = JSON.parse(new TextDecoder().decode(decode(envelope.proof)));
        if (proof.protocol !== protocol || proof.curve !== 'bn128') return { valid: false };
        const sdk = await loadSdk();
        onProgress('Vérification cryptographique locale…');
        return {
          valid: await sdk[protocol].verify(
            compiled.artifact.vk,
            envelope.publicInputs.map((v) => BigInt(v).toString()),
            proof,
            logger,
          ),
        };
      } finally {
        await dispose();
      }
    },
  };
}
