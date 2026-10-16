import { test, expect } from 'vitest';
import { witnessFixture } from '../../helpers/circom.mjs';
import { template } from '../../../shared/circuit.mjs';
const input = (id) => ({ kind: 'input', id });
const constant = (value) => ({
  kind: 'constant',
  type: typeof value === 'boolean' ? 'boolean' : 'number',
  value,
});
const op = (operator, ...args) => ({ kind: 'op', op: operator, args });
const base = (root, types = ['number', 'number']) => ({
  version: 1,
  name: 'Constraints',
  description: '',
  inputs: types.map((type, i) => ({
    id: i ? 'y' : 'x',
    label: i ? 'Y' : 'X',
    type,
    visibility: i ? 'public' : 'private',
    source: 'declared',
  })),
  root,
});
test('dates are constrained inside WASM including leap years, ranges and false majority', async () => {
  const f = await witnessFixture(template());
  try {
    await f.calculate({ in_0: '20000229', in_1: '20080921' });
    for (const birth of ['19000229', '20010229', '19910431', '18991231', '22000101', '20150101'])
      await expect(f.calculate({ in_0: birth, in_1: '20080921' })).rejects.toThrow();
  } finally {
    await f.close();
  }
});
test.each([
  ['add', 4294967295, 1],
  ['sub', 0, 1],
  ['mul', 4294967295, 2],
  ['div', 10, 0],
  ['mod', 10, 0],
])(
  '%s constrains overflow, underflow or zero division even on an unused OR branch',
  async (operator, x, y) => {
    const arithmetic = op(operator, input('x'), input('y'));
    const f = await witnessFixture(
      base(op('or', constant(true), op('eq', arithmetic, constant(0)))),
    );
    try {
      await f.calculate({ in_0: 8, in_1: 2 });
      await expect(f.calculate({ in_0: x, in_1: y })).rejects.toThrow();
      await expect(f.calculate({ in_0: '4294967296', in_1: 2 })).rejects.toThrow();
    } finally {
      await f.close();
    }
  },
);
test('all comparisons, arithmetic, logic and list membership agree in one nested circuit', async () => {
  const x = input('x'),
    y = input('y');
  const clauses = [
    op('eq', op('add', x, y), constant(12)),
    op('ne', x, y),
    op('gt', x, y),
    op('gte', x, x),
    op('lt', y, x),
    op('lte', x, x),
    op('eq', op('sub', x, y), constant(8)),
    op('eq', op('mul', x, y), constant(20)),
    op('eq', op('div', x, y), constant(5)),
    op('eq', op('mod', x, y), constant(0)),
    op('xor', op('not', constant(false)), constant(false)),
    { kind: 'in', value: x, values: [8, 10, 12] },
  ];
  function joinAll(items) {
    if (items.length === 1) return items[0];
    const m = Math.floor(items.length / 2);
    return op('and', joinAll(items.slice(0, m)), joinAll(items.slice(m)));
  }
  const f = await witnessFixture(base(joinAll(clauses)));
  try {
    await f.calculate({ in_0: 10, in_1: 2 });
    await expect(f.calculate({ in_0: 11, in_1: 2 })).rejects.toThrow();
  } finally {
    await f.close();
  }
});
test('booleans cannot be forged with non-binary witnesses', async () => {
  const f = await witnessFixture(base(op('eq', input('x'), input('y')), ['boolean', 'boolean']));
  try {
    await f.calculate({ in_0: 1, in_1: 1 });
    await expect(f.calculate({ in_0: 2, in_1: 2 })).rejects.toThrow();
  } finally {
    await f.close();
  }
});
