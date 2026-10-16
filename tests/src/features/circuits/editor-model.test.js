import { test, expect } from 'vitest';
import { ref, constant, comparison } from '../../../../src/features/circuits/editor-model.js';
test('new logical operands use appropriate number, date and boolean types', () => {
  expect(ref('x')).toEqual({ kind: 'input', id: 'x' });
  expect(constant(2)).toEqual({ kind: 'constant', value: 2, type: 'number' });
  expect(comparison([{ id: 'b', type: 'boolean' }])).toMatchObject({
    op: 'eq',
    args: [{ id: 'b' }, { type: 'boolean', value: true }],
  });
  expect(comparison([{ id: 'd', type: 'date' }]).args[1].type).toBe('date');
  expect(comparison([]).args[0].kind).toBe('constant');
});
