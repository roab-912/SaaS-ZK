import { test, expect } from 'vitest';
import {
  CIRCUIT_CATALOG,
  readyCircuit,
  publicDefaults,
} from '../../../../src/features/circuits/catalog-model.js';
import { evaluateCircuit, validateCircuit } from '../../../../shared/circuit.mjs';
import { ZK_ENGINES } from '../../../../shared/engines.mjs';

test('all ready circuits validate for every supported engine without changing historical templates', () => {
  for (const engine of ZK_ENGINES)
    for (const { id } of CIRCUIT_CATALOG) {
      const c = readyCircuit(id, engine.id);
      expect(validateCircuit(c)).toEqual(c);
      expect(c.version).toBe(2);
      expect(c.engine).toBe(engine.id);
      expect(c.inputs.every((i) => i.source === 'declared')).toBe(true);
      for (const input of c.inputs.filter((i) => i.visibility === 'private'))
        expect(publicDefaults(id)[input.id]).toBeUndefined();
    }
  expect(() => readyCircuit('unknown')).toThrow('Modèle inconnu');
});
test('ready rules prove the intended boundary and both true and false results', () => {
  const revenue = readyCircuit('revenue');
  expect(evaluateCircuit(revenue, { income: '2001', threshold: '2000' })).toBe(true);
  expect(evaluateCircuit(revenue, { income: '2000', threshold: '2000' })).toBe(false);
  expect(evaluateCircuit(revenue, { income: '1999', threshold: '2000' })).toBe(false);
  expect(evaluateCircuit(readyCircuit('income'), { income: '2400', rent: '800' })).toBe(true);
  expect(evaluateCircuit(readyCircuit('income'), { income: '2399', rent: '800' })).toBe(false);
  expect(evaluateCircuit(readyCircuit('list'), { region: '75' })).toBe(true);
  expect(evaluateCircuit(readyCircuit('list'), { region: '13' })).toBe(false);
  expect(evaluateCircuit(readyCircuit('age'), { birth: '2008-10-26', cutoff: '2008-10-26' })).toBe(
    true,
  );
  expect(evaluateCircuit(readyCircuit('age'), { birth: '2008-10-27', cutoff: '2008-10-26' })).toBe(
    false,
  );
});
