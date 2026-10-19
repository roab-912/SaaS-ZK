import { z } from 'zod';
import { ZK_ENGINES, assertEngineCapabilities } from './engines.mjs';
import { policySchema } from './attestations.mjs';
export const LIMITS = { inputs: 12, nodes: 64, depth: 10, list: 32 };
const id = z.string().regex(/^[a-z][a-z0-9_]{0,23}$/);
const scalar = z.union([z.number().int().min(0).max(4294967295), z.boolean()]);
const expr = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('input'), id }).strict(),
    z
      .object({
        kind: z.literal('constant'),
        type: z.enum(['number', 'date', 'boolean']),
        value: scalar,
      })
      .strict(),
    z
      .object({
        kind: z.literal('op'),
        op: z.enum([
          'eq',
          'ne',
          'gt',
          'gte',
          'lt',
          'lte',
          'and',
          'or',
          'xor',
          'not',
          'add',
          'sub',
          'mul',
          'div',
          'mod',
        ]),
        args: z.array(expr).min(1).max(2),
      })
      .strict(),
    z
      .object({
        kind: z.literal('in'),
        value: expr,
        values: z.array(z.number().int().min(0).max(4294967295)).min(1).max(LIMITS.list),
      })
      .strict(),
  ]),
);
export const circuitSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    engine: z.enum(ZK_ENGINES.map((engine) => engine.id)).optional(),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    inputs: z
      .array(
        z
          .object({
            id,
            label: z.string().trim().min(1).max(60),
            type: z.enum(['number', 'date', 'boolean']),
            visibility: z.enum(['private', 'public']),
            source: z.enum(['declared', 'signed']),
            attestation: policySchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.inputs),
    root: expr,
  })
  .strict();

export function isDate(n) {
  if (!Number.isInteger(n) || n < 19000101 || n > 21991231) return false;
  const s = String(n),
    d = new Date(s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10).replaceAll('-', '') === s;
}
export function validateCircuit(raw) {
  // Bound traversal before recursive schema parsing.
  let count = 0;
  function bound(n, depth = 0) {
    if (++count > LIMITS.nodes || depth > LIMITS.depth)
      throw Error('Circuit trop complexe : 64 blocs, 10 niveaux maximum.');
    if (!n || typeof n !== 'object') throw Error('Bloc invalide.');
    if (Array.isArray(n.args)) n.args.forEach((c) => bound(c, depth + 1));
    if (n.kind === 'in') bound(n.value, depth + 1);
  }
  bound(raw?.root);
  const c = circuitSchema.parse(raw);
  assertEngineCapabilities(c);
  if (new Set(c.inputs.map((i) => i.id)).size !== c.inputs.length)
    throw Error('Les identifiants des entrées doivent être uniques.');
  for (const input of c.inputs) {
    if (input.source === 'signed') {
      if (
        c.version !== 2 ||
        !input.attestation ||
        (input.visibility === 'private' && !input.attestation.publicKey)
      )
        throw Error(
          'Les entrées signées nécessitent le mode Vrai ou faux et une source approuvée ; en privé, sa clé publique doit être figée dans le circuit.',
        );
    } else if (input.attestation)
      throw Error('Une entrée déclarée ne doit pas définir de source signataire.');
  }
  const used = new Set();
  function type(n) {
    if (n.kind === 'input') {
      const i = c.inputs.find((i) => i.id === n.id);
      if (!i) throw Error('Entrée inconnue : ' + n.id);
      used.add(i.id);
      return i.type;
    }
    if (n.kind === 'constant') {
      if ((n.type === 'boolean') !== (typeof n.value === 'boolean'))
        throw Error('Type de constante incorrect.');
      if (n.type === 'date' && !isDate(n.value)) throw Error('Date invalide (1900–2199).');
      return n.type;
    }
    if (n.kind === 'in') {
      const t = type(n.value);
      if (t === 'boolean') throw Error('Une liste attend des nombres ou des dates.');
      if (t === 'date' && !n.values.every(isDate)) throw Error('Liste de dates invalide.');
      return 'boolean';
    }
    const ts = n.args.map(type);
    if (n.args.length !== (n.op === 'not' ? 1 : 2)) throw Error('Nombre de branches incorrect.');
    if (['and', 'or', 'xor', 'not'].includes(n.op)) {
      if (ts.some((t) => t !== 'boolean'))
        throw Error('Les opérateurs logiques attendent des conditions.');
      return 'boolean';
    }
    if (ts[0] !== ts[1]) throw Error('Les deux branches doivent avoir le même type.');
    if (['add', 'sub', 'mul', 'div', 'mod'].includes(n.op)) {
      if (ts[0] !== 'number') throw Error('Les calculs attendent des nombres entiers.');
      return 'number';
    }
    if (ts[0] === 'boolean' && !['eq', 'ne'].includes(n.op))
      throw Error('Comparaison de booléens non prise en charge.');
    return 'boolean';
  }
  if (type(c.root) !== 'boolean')
    throw Error('Le résultat final doit être une condition vraie ou fausse.');
  if (c.inputs.some((i) => !used.has(i.id)))
    throw Error('Chaque entrée doit être utilisée dans la règle.');
  return c;
}
