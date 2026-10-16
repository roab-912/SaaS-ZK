import { test, expect } from 'vitest';
import { createEngineRegistry } from '../../zk/registry.mjs';
test('only complete explicitly registered immutable engines can be dispatched', () => {
  const engine = { id: 'second-engine', prove() {}, verify() {} },
    registry = createEngineRegistry([engine], ['prove', 'verify']);
  expect(registry.ids()).toEqual(['second-engine']);
  expect(registry.get('second-engine').prove).toBe(engine.prove);
  expect(Object.isFrozen(registry.get(engine.id))).toBe(true);
  for (const id of ['__proto__', 'constructor', 'https://remote/evil.js'])
    expect(() => registry.get(id)).toThrow();
  expect(() => createEngineRegistry([engine, engine], ['prove'])).toThrow();
  expect(() => createEngineRegistry([{ id: 'incomplete' }], ['prove'])).toThrow();
});
