import { test, expect } from 'vitest';
import { validateCircuit, isDate } from '../../shared/circuit-schema.mjs';
import { template } from '../../shared/circuit-model.mjs';
test('dates, input references, type safety and bounded recursion', () => {
  expect(isDate(20000229)).toBe(true);
  expect(isDate(19000229)).toBe(false);
  expect(isDate(22000101)).toBe(false);
  expect(isDate(20080231)).toBe(false);
  const mutations = [
    (c) => c.inputs.push({ ...c.inputs[0] }),
    (c) => (c.root.args[0].id = 'missing'),
    (c) => c.inputs.push({ ...c.inputs[0], id: 'unused' }),
    (c) => (c.root = { kind: 'input', id: 'birth' }),
    (c) => (c.root.op = 'add'),
    (c) => (c.root.args[0] = { kind: 'constant', type: 'boolean', value: 1 }),
    (c) => (c.root.args[0] = { kind: 'constant', type: 'date', value: 20000230 }),
    (c) => c.root.args.push(c.root.args[0]),
    (c) =>
      (c.root = {
        kind: 'in',
        value: { kind: 'constant', type: 'boolean', value: true },
        values: [1],
      }),
    (c) => (c.root = { kind: 'in', value: { kind: 'input', id: 'birth' }, values: [20230230] }),
  ];
  for (const mutate of mutations) {
    const c = template();
    mutate(c);
    expect(() => validateCircuit(c)).toThrow();
  }
  const cycle = template();
  cycle.root.args[0] = cycle.root;
  expect(() => validateCircuit(cycle)).toThrow(/complexe/);
  const wide = template();
  wide.root.args = Array.from({ length: 65 }, () => ({ kind: 'input', id: 'birth' }));
  expect(() => validateCircuit(wide)).toThrow();
});
