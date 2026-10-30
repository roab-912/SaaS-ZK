import { generateKeyPairSync } from 'node:crypto';
import {
  makeVatExample,
  vatHex,
  vatTextField,
  signVatManifest,
  vatCircuit,
  vatCapacity,
  vatPublicValues,
} from '../../shared/vat.mjs';
import { circuitHash, contextField, buildProofEnvelope } from '../../shared/circuit.mjs';
export async function vatFixture(count = 2, realCommitment = false) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = pair.publicKey.export({ format: 'jwk' }),
    priv = pair.privateKey.export({ format: 'jwk' });
  const draft = makeVatExample('DEMO-VAT', '2026-09-01', '2026-09-30', count);
  const commitment = realCommitment
    ? await (await import('../../zk/noir/vat-runtime.mjs')).prepareVatDraft(draft)
    : {
        companyHash: await vatTextField('clair-vat-company/1:' + draft.companyId),
        commitment: vatHex(123n),
        blinding: vatHex(456n),
      };
  const now = Date.now(),
    manifest = await signVatManifest(
      {
        format: 'clair-vat-manifest/1',
        issuerId: 'vat-demo',
        companyId: draft.companyId,
        companyHash: commitment.companyHash,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        currency: 'EUR',
        scope: 'sales-and-credit-notes/invoice-date',
        rounding: 'half-up-per-invoice-rate',
        complete: true,
        count,
        commitment: commitment.commitment,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 86400000).toISOString(),
      },
      priv,
      pub,
    );
  const batch = {
    format: 'clair-vat-batch/1',
    manifest,
    blinding: commitment.blinding,
    invoices: draft.invoices,
  };
  const circuit = vatCircuit(vatCapacity(count)),
    hash = await circuitHash(circuit),
    values = vatPublicValues(batch);
  const envelope = buildProofEnvelope({
    engine: circuit.engine,
    circuit,
    circuitHash: hash,
    proof: 'AAAA',
    vatManifest: manifest,
    publicInputs: [
      contextField(hash),
      '0x1',
      ...Object.values(values).map((v) =>
        vatHex(typeof v === 'string' ? v.replaceAll('-', '') : v),
      ),
      manifest.commitment,
      manifest.companyHash,
    ],
  });
  return {
    draft,
    batch,
    manifest,
    circuit,
    values,
    envelope,
    pub,
    priv,
    issuers: [{ id: 'vat-demo', name: 'Autorité TVA test', approved: true, jwk: pub }],
  };
}
