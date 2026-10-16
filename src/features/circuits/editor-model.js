export const ref = (id) => ({ kind: 'input', id }),
  constant = (value = 18, type = 'number') => ({ kind: 'constant', type, value });
export const comparison = (inputs) => ({
  kind: 'op',
  op: inputs[0]?.type === 'boolean' ? 'eq' : 'gte',
  args: [
    inputs[0] ? ref(inputs[0].id) : constant(),
    constant(
      inputs[0]?.type === 'boolean' ? true : inputs[0]?.type === 'date' ? 20000101 : 18,
      inputs[0]?.type || 'number',
    ),
  ],
});
