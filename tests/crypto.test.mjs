import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { normalizeInputs } from '../zk/noir/runtime.mjs';
import { compileCircuit } from '../server/compiler.mjs';
import { template, contextField } from '../shared/circuit.mjs';

test(
  'real ZK proof: valid, altered public input and altered proof',
  { timeout: 180000 },
  async () => {
    const circuit = template(),
      compiled = await compileCircuit(circuit);
    const noir = new Noir(compiled.artifact);
    await assert.rejects(() =>
      noir.execute({
        context: contextField(compiled.hash),
        ...normalizeInputs(circuit, { birth: '2015-01-01', cutoff: '2008-09-21' }),
      }),
    );
    await assert.rejects(() =>
      noir.execute({ context: contextField(compiled.hash), in_0: '20070230', in_1: '20080921' }),
    );
    const { witness } = await noir.execute({
      context: contextField(compiled.hash),
      ...normalizeInputs(circuit, { birth: '1990-02-28', cutoff: '2008-09-21' }),
    });
    const backend = new UltraHonkBackend(compiled.artifact.bytecode, { threads: 1 });
    try {
      const proof = await backend.generateProof(witness, { keccakZK: true });
      assert.equal(await backend.verifyProof(proof, { keccakZK: true }), true);
      const pub = [...proof.publicInputs];
      pub[1] = '0x' + (BigInt(pub[1]) + 1n).toString(16).padStart(64, '0');
      assert.equal(
        await backend.verifyProof({ ...proof, publicInputs: pub }, { keccakZK: true }),
        false,
      );
      const altered = new Uint8Array(proof.proof);
      altered[200] ^= 1;
      let rejected = false;
      try {
        rejected = !(await backend.verifyProof({ ...proof, proof: altered }, { keccakZK: true }));
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true);
    } finally {
      await backend.destroy();
    }
  },
);

test('arithmetic overflow and invalid division are constrained', async () => {
  const c = template('income');
  const compiled = await compileCircuit(c);
  const noir = new Noir(compiled.artifact);
  await noir.execute({
    context: contextField(compiled.hash),
    ...normalizeInputs(c, { income: 3000, rent: 1000 }),
  });
  await assert.rejects(() =>
    noir.execute({
      context: contextField(compiled.hash),
      ...normalizeInputs(c, { income: 1, rent: 4294967295 }),
    }),
  );
});
test('all logical operators, membership and nested arithmetic execute', async () => {
  const c = {
    version: 1,
    name: 'Toolbox',
    description: '',
    inputs: [
      { id: 'x', label: 'Valeur', type: 'number', visibility: 'private', source: 'declared' },
    ],
    root: {
      kind: 'op',
      op: 'and',
      args: [
        { kind: 'in', value: { kind: 'input', id: 'x' }, values: [8, 10, 12] },
        {
          kind: 'op',
          op: 'xor',
          args: [
            {
              kind: 'op',
              op: 'eq',
              args: [
                {
                  kind: 'op',
                  op: 'mod',
                  args: [
                    { kind: 'input', id: 'x' },
                    { kind: 'constant', type: 'number', value: 2 },
                  ],
                },
                { kind: 'constant', type: 'number', value: 0 },
              ],
            },
            { kind: 'constant', type: 'boolean', value: false },
          ],
        },
      ],
    },
  };
  const compiled = await compileCircuit(c);
  const noir = new Noir(compiled.artifact);
  await noir.execute({ context: contextField(compiled.hash), in_0: '10' });
  await assert.rejects(() => noir.execute({ context: contextField(compiled.hash), in_0: '11' }));
});
