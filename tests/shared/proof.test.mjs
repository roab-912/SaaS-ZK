import { test, expect } from 'vitest';
import { parseProof, publicValues, contextField } from '../../shared/proof.mjs';
import { proofFixture } from '../helpers/proof.mjs';
test('v1 envelope preserves public dates and excludes secret fields', async () => {
  const proof = await proofFixture();
  expect(parseProof(proof)).toEqual(proof);
  expect(publicValues(proof)[0].value).toBe(20080921);
  expect(contextField(proof.circuitHash)).toHaveLength(64);
  for (const p of [
    { ...proof, privateInputs: {} },
    { ...proof, proof: 'not base64' },
    { ...proof, publicInputs: [] },
    { ...proof, publicInputs: ['0x0', '0x1'] },
    { ...proof, publicInputs: [proof.publicInputs[0], '0x' + 'f'.repeat(65)] },
    { ...proof, circuitHash: 'invalid' },
  ])
    expect(() => parseProof(p)).toThrow();
});
test('reject invalid public booleans and recursive envelopes before parsing', async () => {
  const p = await proofFixture();
  p.circuit.inputs[1].type = 'boolean';
  p.circuit.inputs[0].type = 'boolean';
  p.circuit.root.op = 'eq';
  p.publicInputs[1] = '0x2';
  expect(() => publicValues(p)).toThrow();
  const q = await proofFixture();
  q.circuit.root.args[0] = q.circuit.root;
  expect(() => parseProof(q)).toThrow(/complexe/);
});

test('engine selected in the circuit cannot be substituted in an envelope', async () => {
  const { PLONK_ENGINE } = await import('../../shared/engines.mjs');
  const { circuitHash } = await import('../../shared/circuit-model.mjs');
  const p = await proofFixture();
  p.circuit.engine = PLONK_ENGINE;
  p.circuitHash = await circuitHash(p.circuit);
  p.publicInputs[0] = contextField(p.circuitHash);
  expect(() => parseProof(p)).toThrow(/Moteur/);
  p.engine = PLONK_ENGINE;
  expect(parseProof(p).engine).toBe(PLONK_ENGINE);
});

test('v2 exports readable values and rejects altered public metadata', async () => {
  const { buildProofEnvelope, proofResult } = await import('../../shared/proof.mjs');
  const { circuitHash } = await import('../../shared/circuit-model.mjs');
  const old = await proofFixture(),
    circuit = { ...old.circuit, version: 2 },
    hash = await circuitHash(circuit);
  const p = buildProofEnvelope({
    engine: old.engine,
    circuit,
    circuitHash: hash,
    proof: old.proof,
    publicInputs: [contextField(hash), '0x0', old.publicInputs[1]],
  });
  expect(p.result).toBe(false);
  expect(proofResult(old)).toBe(true);
  expect(p.publicData).toEqual([
    { id: 'cutoff', label: 'Né au plus tard le', type: 'date', value: '2008-09-21' },
  ]);
  for (const mutate of [
    (q) => (q.result = true),
    (q) => (q.publicInputs[1] = '0x2'),
    (q) => (q.publicData[0].value = '2009-09-21'),
    (q) => (q.publicData[0].label = 'Autre seuil'),
    (q) =>
      q.publicData.push({ id: 'birth', label: 'Naissance', type: 'date', value: '1991-07-14' }),
    (q) => (q.format = 'clair-proof/1'),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    expect(() => parseProof(q)).toThrow();
  }
});
test('readable public booleans and numbers preserve their JSON types', async () => {
  const { buildProofEnvelope } = await import('../../shared/proof.mjs');
  const { circuitHash } = await import('../../shared/circuit-model.mjs');
  for (const [type, value, encoded] of [
    ['boolean', false, '0x0'],
    ['number', 4294967295, '0xffffffff'],
  ]) {
    const circuit = {
        version: 2,
        name: 'Valeur publique',
        description: '',
        inputs: [{ id: 'x', label: 'Valeur', type, visibility: 'public', source: 'declared' }],
        root: {
          kind: 'op',
          op: 'eq',
          args: [
            { kind: 'input', id: 'x' },
            { kind: 'constant', type, value },
          ],
        },
      },
      hash = await circuitHash(circuit);
    const p = buildProofEnvelope({
      engine: (await proofFixture()).engine,
      circuit,
      circuitHash: hash,
      proof: 'AAAA',
      publicInputs: [contextField(hash), '0x1', encoded],
    });
    expect(p.publicData[0].value).toBe(value);
  }
});
