import { validateCircuit, isDate } from './circuit-schema.mjs';
export const ops = {
  eq: 'Égal à',
  ne: 'Différent de',
  gt: 'Supérieur à',
  gte: 'Supérieur ou égal',
  lt: 'Inférieur à',
  lte: 'Inférieur ou égal',
  and: 'ET',
  or: 'OU',
  xor: 'OU exclusif',
  not: 'NON',
  add: 'Addition',
  sub: 'Soustraction',
  mul: 'Multiplication',
  div: 'Division entière',
  mod: 'Reste de division',
};
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function circuitHash(c) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical(validateCircuit(c))),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function validateInputs(raw, values) {
  const c = validateCircuit(raw),
    result = {};
  for (const i of c.inputs) {
    let v = values[i.id];
    if (i.type === 'boolean') {
      if (typeof v !== 'boolean') throw Error(i.label + ' : booléen requis.');
    } else {
      if (typeof v !== 'string' && typeof v !== 'number')
        throw Error(i.label + ' : nombre requis.');
      if (typeof v === 'string' && !/^(?:[0-9]+|[0-9]{4}-[0-9]{2}-[0-9]{2})$/.test(v))
        throw Error(i.label + ' : format invalide.');
      if (i.type === 'date' && typeof v === 'string') v = v.replaceAll('-', '');
      if (v === '' || v === undefined || v === null) throw Error(i.label + ' : valeur requise.');
      v = Number(v);
      if (!Number.isInteger(v) || v < 0 || v > 4294967295)
        throw Error(i.label + ' : entier entre 0 et 4 294 967 295 requis.');
      if (i.type === 'date' && !isDate(v)) throw Error(i.label + ' : date invalide.');
    }
    result[i.id] = typeof v === 'boolean' ? v : String(v);
  }
  return result;
}
export function describe(c, n = c.root) {
  if (n.kind === 'input') return c.inputs.find((i) => i.id === n.id)?.label || n.id;
  if (n.kind === 'constant')
    return n.type === 'boolean'
      ? n.value
        ? 'vrai'
        : 'faux'
      : n.type === 'date'
        ? String(n.value).replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')
        : String(n.value);
  if (n.kind === 'in') return describe(c, n.value) + ' appartient à [' + n.values.join(', ') + ']';
  if (n.op === 'not') return 'NON (' + describe(c, n.args[0]) + ')';
  return '(' + describe(c, n.args[0]) + ' ' + ops[n.op] + ' ' + describe(c, n.args[1]) + ')';
}
export function template(which = 'age') {
  const input = (id, label, type = 'number', visibility = 'private') => ({
    id,
    label,
    type,
    visibility,
    source: 'declared',
  });
  const ref = (id) => ({ kind: 'input', id }),
    con = (value, type = 'number') => ({ kind: 'constant', type, value }),
    op = (op, ...args) => ({ kind: 'op', op, args });
  if (which === 'income')
    return {
      version: 1,
      name: 'Capacité financière',
      description:
        'Démontrer que ses revenus couvrent trois fois le loyer, sans révéler ses revenus.',
      inputs: [
        input('income', 'Revenus mensuels'),
        input('rent', 'Loyer mensuel', 'number', 'public'),
      ],
      root: op('gte', ref('income'), op('mul', ref('rent'), con(3))),
    };
  if (which === 'list')
    return {
      version: 1,
      name: 'Zone éligible',
      description: 'Démontrer son appartenance à une liste de départements.',
      inputs: [input('region', 'Département')],
      root: { kind: 'in', value: ref('region'), values: [75, 77, 78, 91, 92, 93, 94, 95] },
    };
  return {
    version: 1,
    name: 'Condition de majorité',
    description:
      'Prouver que la date de naissance déclarée précède le seuil indiqué. Le seuil est public et la preuve reste réutilisable.',
    inputs: [
      input('birth', 'Date de naissance', 'date'),
      input('cutoff', 'Né au plus tard le', 'date', 'public'),
    ],
    root: op('lte', ref('birth'), ref('cutoff')),
  };
}
