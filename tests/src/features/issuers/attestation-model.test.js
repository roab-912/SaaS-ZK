import { test, expect } from 'vitest';
import {
  fieldsForIssuer,
  readPublicCircuit,
} from '../../../../src/features/issuers/attestation-model.js';
import { template } from '../../../../shared/circuit.mjs';
const issuer = { id: 'source-1', keyHash: 'a'.repeat(64) };
const circuit = {
  ...template('blank'),
  version: 2,
  inputs: [
    {
      id: 'value_1',
      label: 'Age',
      type: 'number',
      visibility: 'public',
      source: 'signed',
      attestation: { issuerId: issuer.id, keyHash: issuer.keyHash, claim: 'age' },
    },
  ],
};
test('fields require the precise approved source and pinned key', () => {
  expect(fieldsForIssuer(circuit, issuer)).toEqual(circuit.inputs);
  expect(fieldsForIssuer(circuit, { ...issuer, keyHash: 'b'.repeat(64) })).toEqual([]);
  expect(fieldsForIssuer(circuit, { ...issuer, id: 'other' })).toEqual([]);
  expect(fieldsForIssuer(circuit, null)).toEqual([]);
  expect(fieldsForIssuer(template('blank'), issuer)).toEqual([]);
});
test('public circuit import supports exports, records and proof envelopes', () => {
  for (const value of [circuit, { schema: circuit }, { circuit }])
    expect(readPublicCircuit(JSON.stringify(value))).toEqual(circuit);
});
test.each(['{}', 'null', 'invalid', 'x'.repeat(300001)])(
  'invalid circuit files are rejected',
  (text) => {
    expect(() => readPublicCircuit(text)).toThrow(/Fichier de circuit invalide/);
  },
);
