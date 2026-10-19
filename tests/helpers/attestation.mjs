import { generateSigningKey, signAttestation } from '../../shared/attestations.mjs';
export async function signedFixture(type = 'number', value = 3000) {
  const keys = await generateSigningKey(),
    now = Date.now();
  const attestation = await signAttestation(
    {
      format: 'clair-attestation/1',
      id: crypto.randomUUID(),
      issuerId: 'source-1',
      keyHash: keys.keyHash,
      claim: 'income_monthly_eur',
      type,
      value,
      issuedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 86400000).toISOString(),
    },
    keys.privateKey,
    keys.publicKey,
  );
  const circuit = {
    version: 2,
    name: 'Donnée signée',
    description: '',
    inputs: [
      {
        id: 'income',
        label: 'Revenu public',
        type,
        visibility: 'public',
        source: 'signed',
        attestation: {
          issuerId: attestation.issuerId,
          keyHash: keys.keyHash,
          claim: attestation.claim,
        },
      },
    ],
    root: {
      kind: 'op',
      op: 'eq',
      args: [
        { kind: 'input', id: 'income' },
        {
          kind: 'constant',
          type,
          value: type === 'date' ? Number(value.replaceAll('-', '')) : value,
        },
      ],
    },
  };
  return {
    keys,
    attestation,
    circuit,
    values: { income: value },
    attestations: [{ inputId: 'income', attestation }],
    issuers: [{ id: 'source-1', name: 'Source de test', jwk: keys.publicKey }],
  };
}
