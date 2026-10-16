import { template, circuitHash } from '../../shared/circuit.mjs';
import { ENGINE, PROOF_FORMAT, contextField } from '../../shared/proof.mjs';
export async function proofFixture() {
  const circuit = template(),
    hash = await circuitHash(circuit);
  return {
    format: PROOF_FORMAT,
    engine: ENGINE,
    circuit,
    circuitHash: hash,
    publicInputs: [contextField(hash), '0x' + (20080921).toString(16)],
    proof: 'AAAA',
  };
}
