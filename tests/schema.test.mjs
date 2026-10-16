import { test } from 'vitest';
import assert from 'node:assert/strict';
import { template, validateCircuit, circuitHash, validateInputs } from '../shared/circuit.mjs';
test('hash commits to labels, privacy and public statement', async () => {
  const a = template();
  const h = await circuitHash(a);
  for (const mutate of [
    (c) => (c.name = 'Other'),
    (c) => (c.inputs[0].visibility = 'public'),
    (c) => (c.root.op = 'gt'),
  ]) {
    const b = structuredClone(a);
    mutate(b);
    assert.notEqual(await circuitHash(b), h);
  }
  const b = {
    root: a.root,
    inputs: a.inputs,
    description: a.description,
    name: a.name,
    version: a.version,
  };
  assert.equal(await circuitHash(b), h);
});
test('invalid types, unused inputs, dates and depth rejected', () => {
  const c = template();
  c.root.args[1] = { kind: 'constant', type: 'number', value: 18 };
  assert.throws(() => validateCircuit(c));
  assert.throws(() => validateInputs(template(), { birth: '2007-02-30', cutoff: '2008-09-21' }));
  const b = template();
  for (let i = 0; i < 11; i++) b.root = { kind: 'op', op: 'not', args: [b.root] };
  assert.throws(() => validateCircuit(b), /complexe/);
  const d = template();
  d.inputs[0].id = 'injected);';
  assert.throws(() => validateCircuit(d));
});
