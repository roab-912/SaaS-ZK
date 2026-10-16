import { validateCircuit } from '../../shared/circuit-schema.mjs';
import { contextField } from '../../shared/proof.mjs';

// Each hint (<--) is constrained independently; witness generation is not a trust boundary.
const primitives = `pragma circom 2.2.3;
template Bits(n) {
 signal input in;
 signal output bits[n];
 var sum = 0;
 for (var i = 0; i < n; i++) {
  bits[i] <-- (in >> i) & 1;
  bits[i] * (bits[i] - 1) === 0;
  sum += bits[i] * (2 ** i);
 }
 sum === in;
}
template Equal() {
 signal input a; signal input b; signal output out; signal inv;
 inv <-- a != b ? 1 / (a - b) : 0;
 out <== 1 - (a - b) * inv;
 (a - b) * out === 0;
}
template Less() {
 signal input a; signal input b; signal output out;
 component bits = Bits(33);
 bits.in <== a + 4294967296 - b;
 out <== 1 - bits.bits[32];
}
template Divide() {
 signal input a; signal input b; signal output q; signal output r; signal inv;
 inv <-- b != 0 ? 1/b : 0;
 b * inv === 1;
 q <-- a \\ b;
 r <-- a % b;
 component qb = Bits(32); qb.in <== q;
 component rb = Bits(32); rb.in <== r;
 component lt = Less(); lt.a <== r; lt.b <== b; lt.out === 1;
 a === b * q + r;
}
template DateCheck() {
 signal input in;
 component split = Divide(); split.a <== in; split.b <== 10000;
 component md = Divide(); md.a <== split.r; md.b <== 100;
 component lower = Less(); lower.a <== split.q; lower.b <== 1900; lower.out === 0;
 component upper = Less(); upper.a <== split.q; upper.b <== 2200; upper.out === 1;
 component ml = Less(); ml.a <== md.q; ml.b <== 1; ml.out === 0;
 component mu = Less(); mu.a <== md.q; mu.b <== 13; mu.out === 1;
 component dl = Less(); dl.a <== md.r; dl.b <== 1; dl.out === 0;
 component mod4 = Divide(); mod4.a <== split.q; mod4.b <== 4;
 component mod100 = Divide(); mod100.a <== split.q; mod100.b <== 100;
 component mod400 = Divide(); mod400.a <== split.q; mod400.b <== 400;
 component e4 = Equal(); e4.a <== mod4.r; e4.b <== 0;
 component e100 = Equal(); e100.a <== mod100.r; e100.b <== 0;
 component e400 = Equal(); e400.a <== mod400.r; e400.b <== 0;
 signal leap; leap <== e4.out * (1 - e100.out + e400.out);
 component feb = Equal(); feb.a <== md.q; feb.b <== 2;
 component apr = Equal(); apr.a <== md.q; apr.b <== 4;
 component jun = Equal(); jun.a <== md.q; jun.b <== 6;
 component sep = Equal(); sep.a <== md.q; sep.b <== 9;
 component nov = Equal(); nov.a <== md.q; nov.b <== 11;
 signal days; days <== 31 - apr.out - jun.out - sep.out - nov.out - feb.out * (3 - leap);
 component du = Less(); du.a <== days; du.b <== md.r; du.out === 0;
}
`;
export function circomSource(raw, hash) {
  const c = validateCircuit(raw),
    lines = [],
    publicNames = ['context'];
  let index = 0;
  const component = (name, inputs) => {
    const id = 'c' + index++;
    lines.push('component ' + id + ' = ' + name + ';');
    for (const [key, value] of Object.entries(inputs))
      lines.push(id + '.' + key + ' <== ' + value + ';');
    return id;
  };
  const signal = (expression) => {
    const id = 's' + index++;
    lines.push('signal ' + id + ';', id + ' <== ' + expression + ';');
    return id;
  };
  const equal = (a, b) => component('Equal()', { a, b }) + '.out';
  const less = (a, b) => component('Less()', { a, b }) + '.out';
  const or = (a, b) => signal(a + ' + ' + b + ' - ' + a + '*' + b);
  function emit(n) {
    if (n.kind === 'input') return 'in_' + c.inputs.findIndex((i) => i.id === n.id);
    if (n.kind === 'constant') return String(Number(n.value));
    if (n.kind === 'in') {
      const value = emit(n.value);
      return n.values.map((v) => equal(value, String(v))).reduce(or);
    }
    const a = emit(n.args[0]);
    if (n.op === 'not') return signal('1 - ' + a);
    const b = emit(n.args[1]);
    switch (n.op) {
      case 'eq':
        return equal(a, b);
      case 'ne':
        return signal('1 - ' + equal(a, b));
      case 'lt':
        return less(a, b);
      case 'gt':
        return less(b, a);
      case 'lte':
        return signal('1 - ' + less(b, a));
      case 'gte':
        return signal('1 - ' + less(a, b));
      case 'and':
        return signal(a + '*' + b);
      case 'or':
        return or(a, b);
      case 'xor':
        return signal(a + ' + ' + b + ' - 2*' + a + '*' + b);
      case 'div':
      case 'mod': {
        const div = component('Divide()', { a, b });
        return div + (n.op === 'div' ? '.q' : '.r');
      }
      default: {
        const value = signal(a + { add: ' + ', sub: ' - ', mul: ' * ' }[n.op] + b);
        component('Bits(32)', { in: value });
        return value;
      }
    }
  }
  // Declaration order defines the public statement: context, then public inputs in domain order.
  lines.push('signal input context;', 'context === ' + BigInt(contextField(hash)) + ';');
  for (const [i, input] of c.inputs.entries()) {
    lines.push('signal input in_' + i + ';');
    if (input.visibility === 'public') publicNames.push('in_' + i);
    component(input.type === 'boolean' ? 'Bits(1)' : 'Bits(32)', { in: 'in_' + i });
    if (input.type === 'date') component('DateCheck()', { in: 'in_' + i });
  }
  lines.push(emit(c.root) + ' === 1;');
  return (
    primitives +
    '\ntemplate Rule() {\n' +
    lines.join('\n') +
    '\n}\ncomponent main {public [' +
    publicNames.join(', ') +
    ']} = Rule();\n'
  );
}
