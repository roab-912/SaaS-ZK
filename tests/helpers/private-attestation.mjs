import { signedFixture } from './attestation.mjs';
import { signAttestation } from '../../shared/attestations.mjs';
import { ENGINE } from '../../shared/engines.mjs';
export async function privateFixture(type = 'number', value = 3456789) {
  const f = await signedFixture(type, value);
  f.circuit.engine = ENGINE;
  f.circuit.inputs[0].visibility = 'private';
  f.circuit.inputs[0].label = 'Revenu privé';
  f.circuit.inputs[0].attestation.publicKey = f.keys.publicKey;
  f.circuit.root.op = type === 'boolean' ? 'eq' : 'gte';
  f.circuit.root.args[1].value = type === 'number' ? 2500 : type === 'date' ? 19000101 : true;
  const { publicKey, signature: _signature, ...payload } = f.attestation;
  f.attestation = await signAttestation(
    { ...payload, format: 'clair-attestation/2' },
    f.keys.privateKey,
    publicKey,
  );
  f.attestations = [{ inputId: 'income', attestation: f.attestation }];
  return f;
}
