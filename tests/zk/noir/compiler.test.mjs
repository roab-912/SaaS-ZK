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

test('compiler resource failures do not leak environment secrets and clean their temporary files', async () => {
  const { stat } = await import('node:fs/promises');
  let directory;
  await expect(
    compileNoir(template(), {
      run: async (binary, args, options) => {
        directory = args.at(-1);
        expect(options.env.STRIPE_SECRET_KEY).toBeUndefined();
        expect(options.env.NODE_OPTIONS).toBeUndefined();
        expect(options.timeout).toBe(180000);
        expect(args).toContain('--max-old-space-size=512');
        throw Error('subprocess diagnostic with confidential data');
      },
    }),
  ).rejects.toMatchObject({
    code: 'COMPILER_RESOURCE_LIMIT',
    message: 'La compilation a échoué ou dépassé sa limite de ressources.',
  });
  await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});
