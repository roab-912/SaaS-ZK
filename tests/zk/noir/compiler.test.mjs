import { test, expect } from 'vitest';
import { compileNoir } from '../../../zk/noir/compiler.mjs';
import { template, circuitHash, ENGINE } from '../../../shared/circuit.mjs';
test('real compiler produces matching public ABI and deterministic bytecode', async () => {
  const c = template('list'),
    a = await compileNoir(c),
    b = await compileNoir(c);
  expect(a.hash).toBe(await circuitHash(c));
  expect(a.engine).toBe(ENGINE);
  expect(a.artifact.bytecode).toBe(b.artifact.bytecode);
  expect(a.artifact.abi.parameters[0]).toMatchObject({ name: 'context', visibility: 'public' });
  expect(a.artifact.abi.parameters[1].visibility).toBe('private');
  await expect(compileNoir({})).rejects.toThrow();
});
