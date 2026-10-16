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
