import { validateCircuit } from './circuit-schema.mjs';
import { validateInputs } from './circuit-model.mjs';

// Local diagnostics only. The ZK circuits independently constrain this result.
export function evaluateCircuit(raw, values) {
  const circuit = validateCircuit(raw),
    normalized = validateInputs(circuit, values);
  const inputs = Object.fromEntries(
    circuit.inputs.map((i) => [
      i.id,
      i.type === 'boolean' ? normalized[i.id] : BigInt(normalized[i.id]),
    ]),
  );
  const bounded = (value) => {
    if (value < 0n || value > 4294967295n)
      throw Error(
        'Un calcul dépasse les limites : chaque résultat entier doit rester entre 0 et 4 294 967 295.',
      );
    return value;
  };
  function evaluate(node) {
    if (node.kind === 'input') return inputs[node.id];
    if (node.kind === 'constant')
      return typeof node.value === 'boolean' ? node.value : BigInt(node.value);
    if (node.kind === 'in') {
      const value = evaluate(node.value);
      return node.values.some((v) => BigInt(v) === value);
    }
    const a = evaluate(node.args[0]);
    if (node.op === 'not') return !a;
    // Evaluate both branches, matching the constraints even when a boolean result is known.
    const b = evaluate(node.args[1]);
    switch (node.op) {
      case 'eq':
        return a === b;
      case 'ne':
        return a !== b;
      case 'gt':
        return a > b;
      case 'gte':
        return a >= b;
      case 'lt':
        return a < b;
      case 'lte':
        return a <= b;
      case 'and':
        return a && b;
      case 'or':
        return a || b;
      case 'xor':
        return a !== b;
      case 'add':
        return bounded(a + b);
      case 'sub':
        return bounded(a - b);
      case 'mul':
        return bounded(a * b);
      case 'div':
      case 'mod':
        if (b === 0n)
          throw Error(
            'Division par zéro dans la règle. Le diviseur doit être différent de zéro, y compris dans une branche d’un OU.',
          );
        return node.op === 'div' ? a / b : a % b;
      default:
        throw Error('Opérateur non pris en charge.');
    }
  }
  return evaluate(circuit.root);
}
