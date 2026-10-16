import { test, expect } from 'vitest';
import * as domain from '../../shared/circuit.mjs';
test('domain facade exposes portable circuits without importing an engine', () => {
  expect(domain.validateCircuit(domain.template())).toMatchObject({ version: 1 });
  expect(domain).not.toHaveProperty('noirSource');
  expect(domain).not.toHaveProperty('normalizeInputs');
  expect(domain.parseProof).toBeTypeOf('function');
});
