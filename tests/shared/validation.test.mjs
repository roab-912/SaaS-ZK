import { test, expect } from 'vitest';
import { z } from 'zod';
import { validationMessage } from '../../shared/validation.mjs';
import { validateCircuit, template } from '../../shared/circuit.mjs';
test('validation identifies the field without exposing its rejected value', () => {
  const c = template();
  c.name = '';
  c.inputs[1].label = '';
  let error;
  try {
    validateCircuit(c);
  } catch (e) {
    error = e;
  }
  expect(validationMessage(error)).toContain('Nom du circuit');
  expect(validationMessage(error)).toContain('Entrée 2 — Libellé');
  const secret = 'private-secret';
  const e = z.object({ password: z.enum(['allowed']) }).safeParse({ password: secret }).error;
  expect(validationMessage(e)).toContain('Mot de passe');
  expect(validationMessage(e)).not.toContain(secret);
  expect(validationMessage(Error('Division par zéro'))).toBe('Division par zéro');
});
test('nested paths and stale schemas yield actionable bounded messages', () => {
  expect(
    validationMessage({
      issues: [{ path: ['root', 'args', 1, 'op'], code: 'invalid_enum_value' }],
    }),
  ).toContain('Bloc principal → branche B');
  expect(validationMessage({ issues: [{ path: [], code: 'unrecognized_keys' }] })).toContain(
    'serveur est à jour',
  );
  expect(validationMessage(z.object({ name: z.string() }).safeParse({}).error)).toContain(
    'champ requis',
  );
  expect(
    validationMessage(z.object({ name: z.string().max(3) }).safeParse({ name: 'long' }).error),
  ).toContain('maximum 3');
});
