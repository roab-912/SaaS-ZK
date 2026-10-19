import { validateCircuit } from '../../../shared/circuit.mjs';
export function fieldsForIssuer(circuit, issuer) {
  if (!issuer) return [];
  return validateCircuit(circuit).inputs.filter(
    (i) =>
      i.source === 'signed' &&
      i.attestation.issuerId === issuer.id &&
      i.attestation.keyHash === issuer.keyHash,
  );
}
export function readPublicCircuit(text) {
  try {
    if (typeof text !== 'string' || text.length > 300000) throw Error();
    const raw = JSON.parse(text);
    return validateCircuit(raw?.circuit ?? raw?.schema ?? raw);
  } catch {
    throw Error(
      'Fichier de circuit invalide. Importez le circuit public exporté depuis l’éditeur (300 Ko maximum).',
    );
  }
}
