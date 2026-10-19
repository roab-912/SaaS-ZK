import { validateCircuit } from '../../shared/circuit-schema.mjs';
import { contextField } from '../../shared/proof.mjs';
import { privateSignatureSource } from './private-signatures.mjs';
const operators = {
  eq: '==',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  and: '&',
  or: '|',
  xor: '^',
  add: '+',
  sub: '-',
  mul: '*',
  div: '/',
  mod: '%',
};
export function noirSource(raw, hash) {
  const c = validateCircuit(raw);
  function emit(n) {
    if (n.kind === 'input') return 'in_' + c.inputs.findIndex((i) => i.id === n.id);
    if (n.kind === 'constant')
      return typeof n.value === 'boolean' ? String(n.value) : '(' + n.value + ' as u32)';
    if (n.kind === 'in')
      return (
        '(' + n.values.map((v) => '(' + emit(n.value) + ' == (' + v + ' as u32))').join(' | ') + ')'
      );
    if (n.op === 'not') return '(!' + emit(n.args[0]) + ')';
    return '(' + emit(n.args[0]) + ' ' + operators[n.op] + ' ' + emit(n.args[1]) + ')';
  }
  const params = c.inputs.map(
    (i, n) =>
      'in_' +
      n +
      ': ' +
      (i.visibility === 'public' ? 'pub ' : '') +
      (i.type === 'boolean' ? 'bool' : 'u32'),
  );
  const signatures = privateSignatureSource(c);
  params.push(...signatures.params);
  if (c.version === 2) params.unshift('result: pub bool');
  const dates = c.inputs.flatMap((i, n) =>
    i.type === 'date'
      ? ['assert(in_' + n + ' >= 19000101);', 'assert(in_' + n + ' <= 21991231);']
      : [],
  );
  // Date validity must be constrained, not just checked in the UI.
  const dateChecks = c.inputs.flatMap((i, n) =>
    i.type === 'date'
      ? [
          'let y' + n + ' = in_' + n + ' / 10000;',
          'let m' + n + ' = (in_' + n + ' / 100) % 100;',
          'let d' + n + ' = in_' + n + ' % 100;',
          'assert(m' + n + ' >= 1 & m' + n + ' <= 12);',
          'let leap' +
            n +
            ' = (y' +
            n +
            ' % 4 == 0) & ((y' +
            n +
            ' % 100 != 0) | (y' +
            n +
            ' % 400 == 0));',
          'let days' +
            n +
            ' = if m' +
            n +
            ' == 2 { if leap' +
            n +
            ' { 29 } else { 28 } } else if (m' +
            n +
            ' == 4) | (m' +
            n +
            ' == 6) | (m' +
            n +
            ' == 9) | (m' +
            n +
            ' == 11) { 30 } else { 31 };',
          'assert(d' + n + ' >= 1 & d' + n + ' <= days' + n + ');',
        ]
      : [],
  );
  return (
    'fn main(context: pub Field, ' +
    params.join(', ') +
    ') {\n assert(context == ' +
    contextField(hash) +
    ');\n ' +
    [...dates, ...dateChecks, ...signatures.checks].join('\n ') +
    '\n assert(' +
    (c.version === 2 ? '(' + emit(c.root) + ') == result' : emit(c.root)) +
    ');\n}\n'
  );
}
