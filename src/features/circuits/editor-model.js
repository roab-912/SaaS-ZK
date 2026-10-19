export const ref = (id) => ({ kind: 'input', id }),
  constant = (value = 18, type = 'number') => ({ kind: 'constant', type, value });
export function removeInput(circuit, id) {
  const removed = circuit.inputs.find((i) => i.id === id),
    inputs = circuit.inputs.filter((i) => i.id !== id);
  if (!removed || !inputs.length) return circuit;
  const replacement = inputs.find((i) => i.type === removed.type) ?? inputs[0];
  function visit(node) {
    if (node.kind === 'input') return node.id === id ? ref(replacement.id) : node;
    if (node.kind === 'op') return { ...node, args: node.args.map(visit) };
    if (node.kind === 'in') return { ...node, value: visit(node.value) };
    return node;
  }
  return { ...circuit, inputs, root: visit(circuit.root) };
}
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
