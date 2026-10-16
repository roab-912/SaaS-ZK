import { test, expect } from 'vitest';
import {
  ENGINE,
  PLONK_ENGINE,
  FFLONK_ENGINE,
  ZK_ENGINES,
  engineName,
} from '../../shared/engines.mjs';
import { validateCircuit } from '../../shared/circuit-schema.mjs';
import { template, circuitHash } from '../../shared/circuit-model.mjs';
test('engine choices are immutable, versioned and distinguish circuit versions without altering legacy schemas', async () => {
  const c = template();
  expect(validateCircuit(c)).toEqual(c);
  expect(validateCircuit(c)).not.toHaveProperty('engine');
  expect(new Set(ZK_ENGINES.map((e) => e.id)).size).toBe(3);
  expect(Object.isFrozen(ZK_ENGINES)).toBe(true);
  expect(engineName()).toBe('Noir / UltraHonk');
  expect(engineName('unknown')).toBe('Moteur inconnu');
  expect(ZK_ENGINES.find((e) => e.id === FFLONK_ENGINE).experimental).toBe(true);
  const hashes = await Promise.all(
    [undefined, ENGINE, PLONK_ENGINE, FFLONK_ENGINE].map((engine) =>
      circuitHash({ ...c, ...(engine ? { engine } : {}) }),
    ),
  );
  expect(new Set(hashes).size).toBe(4);
  expect(() => validateCircuit({ ...c, engine: 'untrusted' })).toThrow();
});
