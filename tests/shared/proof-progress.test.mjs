import { test, expect } from 'vitest';
import { PROOF_STEPS, isProofStage } from '../../shared/proof-progress.mjs';
test('only fixed public stage identifiers are accepted', () => {
  expect(PROOF_STEPS.map((s) => s.id)).toEqual([
    'prepare',
    'validate',
    'witness',
    'prove',
    'verify',
    'finish',
  ]);
  for (const step of PROOF_STEPS) expect(isProofStage(step.id)).toBe(true);
  for (const value of [undefined, null, {}, 'private witness', 'toString'])
    expect(isProofStage(value)).toBe(false);
  expect(Object.isFrozen(PROOF_STEPS)).toBe(true);
  expect(PROOF_STEPS.every(Object.isFrozen)).toBe(true);
});
