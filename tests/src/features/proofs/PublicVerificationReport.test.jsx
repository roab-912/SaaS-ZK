// @vitest-environment jsdom
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicVerificationReport } from '../../../../src/features/proofs/PublicVerificationReport.jsx';
import { proofFixture } from '../../../helpers/proof.mjs';
test('the print report explicitly allows public values and never serializes private or cryptographic payloads', async () => {
  const envelope = await proofFixture();
  Object.assign(envelope, {
    witness: { birth: 'PRIVATE_MARKER' },
    proof: 'PRIVATE_PROOF_BYTES',
    privateKey: 'PRIVATE_KEY',
  });
  render(
    <PublicVerificationReport
      envelope={envelope}
      status="valid"
      checkedAt="2026-11-02T12:00:00.000Z"
      sources={[{ issuerName: 'Autorité', valid: true, privateKey: 'SOURCE_SECRET' }]}
    />,
  );
  const report = screen.getByRole('article');
  expect(report).toHaveTextContent('Preuve valide');
  expect(report).toHaveTextContent('21/09/2008');
  expect(report).toHaveTextContent('02/11/2026');
  for (const secret of ['PRIVATE_MARKER', 'PRIVATE_PROOF_BYTES', 'PRIVATE_KEY', 'SOURCE_SECRET'])
    expect(report).not.toHaveTextContent(secret);
  expect(report).toHaveTextContent(envelope.circuitHash);
  expect(report).toHaveTextContent('Autorité');
});
test('an invalid proof is never presented as a proven statement', async () => {
  const envelope = await proofFixture();
  render(
    <PublicVerificationReport
      envelope={envelope}
      status="invalid"
      checkedAt="2026-11-02"
      error="Empreinte différente"
    />,
  );
  expect(screen.getByRole('article')).toHaveTextContent('Résultat annoncé, non validé');
  expect(screen.getByRole('article')).toHaveTextContent('Empreinte différente');
});
test('a valid false result is explicit and differs from an invalid proof', async () => {
  const envelope = await proofFixture();
  envelope.circuit.version = 2;
  envelope.result = false;
  envelope.publicInputs.splice(1, 0, '0x0');
  render(<PublicVerificationReport envelope={envelope} status="valid" checkedAt="2026-11-02" />);
  expect(screen.getByRole('article')).toHaveTextContent('Faux');
  expect(screen.getByRole('article')).toHaveTextContent('condition demandée n’est pas satisfaite');
});
