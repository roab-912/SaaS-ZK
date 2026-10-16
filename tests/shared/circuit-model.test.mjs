import { test, expect } from 'vitest';
import {
  template,
  validateInputs,
  canonical,
  circuitHash,
  describe,
} from '../../shared/circuit-model.mjs';
test('canonical schema fingerprint stays stable across object order', async () => {
  const c = template();
  expect(canonical({ b: 1, a: [true] })).toBe('{"a":[true],"b":1}');
  expect(await circuitHash(c)).toBe(
    await circuitHash({
      root: c.root,
      inputs: c.inputs,
      description: c.description,
      name: c.name,
      version: 1,
    }),
  );
  expect(describe(c)).toContain('Date de naissance');
  expect(describe(template('income'))).toContain('Multiplication');
  expect(describe(template('list'))).toContain('appartient');
});
test('private inputs use domain IDs and reject coercion tricks', () => {
  expect(validateInputs(template(), { birth: '2000-02-29', cutoff: 20080921 })).toEqual({
    birth: '20000229',
    cutoff: '20080921',
  });
  for (const v of [true, {}, [], null, '', ' 12', '0x12', '1e3', 4294967296, -1])
    expect(() => validateInputs(template('income'), { income: v, rent: 1 })).toThrow();
  const c = {
    version: 1,
    name: 'Bool',
    description: '',
    inputs: [
      { id: 'b', label: 'Bool', type: 'boolean', visibility: 'private', source: 'declared' },
    ],
    root: { kind: 'input', id: 'b' },
  };
  expect(validateInputs(c, { b: true })).toEqual({ b: true });
  expect(() => validateInputs(c, { b: 'true' })).toThrow();
  expect(describe({ ...c, root: { kind: 'op', op: 'not', args: [c.root] } })).toBe('NON (Bool)');
});
