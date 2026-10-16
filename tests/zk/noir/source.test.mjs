import { test, expect } from 'vitest';
import { noirSource } from '../../../zk/noir/source.mjs';
import { template, circuitHash } from '../../../shared/circuit.mjs';
test('source constrains dates, context and typed public/private inputs', async () => {
  const c = template(),
    s = noirSource(c, await circuitHash(c));
  expect(s).toContain('context: pub Field');
  expect(s).toContain('in_0: u32');
  expect(s).toContain('in_1: pub u32');
  expect(s).toContain('% 400');
  expect(s).toContain('days0');
  expect(s).toContain('assert((in_0 <= in_1))');
  c.name = 'fn main() { attack }';
  expect(noirSource(c, await circuitHash(c))).not.toContain('attack');
});
test('membership and arithmetic compile from trusted operators only', async () => {
  const c = template('list');
  expect(noirSource(c, await circuitHash(c))).toContain('== (75 as u32)');
  c.root = { kind: 'op', op: 'execute', args: [] };
  expect(() => noirSource(c, '0'.repeat(64))).toThrow();
});
