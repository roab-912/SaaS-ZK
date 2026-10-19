import { test, expect } from 'vitest';
import { evaluateCircuit } from '../../shared/evaluate.mjs';
import { template } from '../../shared/circuit.mjs';
const input = { kind: 'input', id: 'x' };
const number = (value) => ({ kind: 'constant', type: 'number', value });
const op = (op, ...args) => ({ kind: 'op', op, args });
const rule = (root) => ({
  version: 2,
  name: 'Calcul',
  description: '',
  inputs: [{ id: 'x', label: 'Valeur', type: 'number', visibility: 'private', source: 'declared' }],
  root,
});
test('comparison outcomes include false, equality and unsigned boundaries', () => {
  for (const [name, a, b, want] of [
    ['gte', 0, 1, false],
    ['gte', 1, 1, true],
    ['gt', 4294967295, 0, true],
    ['lt', 0, 1, true],
    ['lte', 1, 1, true],
    ['eq', 1, 1, true],
    ['ne', 1, 2, true],
  ])
    expect(evaluateCircuit(rule(op(name, input, number(b))), { x: a })).toBe(want);
});
test('arithmetic and membership evaluate with integer precision', () => {
  for (const [name, a, b, want] of [
    ['add', 2, 3, 5],
    ['sub', 3, 2, 1],
    ['mul', 3, 2, 6],
    ['div', 7, 2, 3],
    ['mod', 7, 2, 1],
  ])
    expect(
      evaluateCircuit(rule(op('eq', op(name, input, number(b)), number(want))), { x: a }),
    ).toBe(true);
  expect(evaluateCircuit(rule({ kind: 'in', value: input, values: [1, 2] }), { x: 3 })).toBe(false);
  for (const name of ['and', 'or', 'xor'])
    expect(
      evaluateCircuit(
        rule(op(name, op('eq', input, number(1)), op('not', op('eq', input, number(2))))),
        { x: 1 },
      ),
    ).toBe(name !== 'xor');
});
test('missing inputs, invalid dates and impossible calculations give local diagnostics', () => {
  expect(() => evaluateCircuit(rule(op('eq', input, number(0))), {})).toThrow(/requise/);
  expect(() =>
    evaluateCircuit(template(), { birth: '2007-02-30', cutoff: '2008-09-21' }),
  ).toThrow();
  for (const [name, a, b] of [
    ['sub', 0, 1],
    ['add', 4294967295, 1],
    ['mul', 4294967295, 4294967295],
  ])
    expect(() =>
      evaluateCircuit(rule(op('eq', op(name, input, number(b)), number(0))), { x: a }),
    ).toThrow(/limites/);
  for (const name of ['div', 'mod'])
    expect(() =>
      evaluateCircuit(
        rule(op('or', op('eq', input, number(7)), op('eq', op(name, input, number(0)), number(1)))),
        { x: 7 },
      ),
    ).toThrow(/zéro/);
});
