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

test('deleting an input replaces all references, including membership and nested branches', async () => {
  const { removeInput } = await import('../../../../src/features/circuits/editor-model.js');
  const c = {
    inputs: [
      { id: 'birth', type: 'date' },
      { id: 'other', type: 'number' },
      { id: 'cutoff', type: 'date' },
    ],
    root: {
      kind: 'op',
      op: 'and',
      args: [
        { kind: 'op', op: 'eq', args: [ref('birth'), constant(20000101, 'date')] },
        { kind: 'in', value: ref('birth'), values: [20000101] },
      ],
    },
  };
  const original = JSON.stringify(c),
    next = removeInput(c, 'birth');
  expect(JSON.stringify(c)).toBe(original);
  expect(next.root.args[0].args[0]).toEqual(ref('cutoff'));
  expect(next.root.args[1].value).toEqual(ref('cutoff'));
  expect(next.inputs.map((i) => i.id)).toEqual(['other', 'cutoff']);
  expect(removeInput({ inputs: [{ id: 'only' }], root: ref('only') }, 'only').inputs).toHaveLength(
    1,
  );
});
