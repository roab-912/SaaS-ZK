import { test, expect } from 'vitest';
import { Noir } from '@noir-lang/noir_js';
import { compileNoir } from '../../../zk/noir/compiler.mjs';
import { vatWitness } from '../../../zk/noir/vat-runtime.mjs';
import { normalizeInputs } from '../../../zk/noir/runtime.mjs';
import { contextField } from '../../../shared/proof.mjs';
import { vatFixture } from '../../helpers/vat.mjs';
test('real Noir constraints reject altered taxes, omitted or duplicated rows, invalid dates and padding', async () => {
  const f = await vatFixture(2, true),
    compiled = await compileNoir(f.circuit),
    noir = new Noir(compiled.artifact);
  const witness = {
    context: contextField(compiled.hash),
    result: true,
    ...normalizeInputs(f.circuit, f.values),
    ...(await vatWitness(f.batch, 10)),
  };
  await noir.execute(witness);
  const attacks = [
    (w) => {
      w.in_3 = String(Number(w.in_3) + 1);
    },
    (w) => {
      w.rows[0][0] = '20260831';
    },
    (w) => {
      w.rows[0][0] = '20260931';
    },
    (w) => {
      w.rows[0][7] = '1';
    },
    (w) => {
      w.rows[1] = [...w.rows[0]];
      w.metadata[1] = [...w.metadata[0]];
    },
    (w) => {
      w.rows[1] = Array(12).fill('0');
      w.metadata[1] = Array(3).fill('0');
    },
    (w) => {
      w.rows[2][0] = '20260901';
    },
    (w) => {
      w.in_2 = '1';
    },
    (w) => {
      w.blinding = '1';
    },
  ];
  for (const change of attacks) {
    const w = structuredClone(witness);
    change(w);
    await expect(noir.execute(w)).rejects.toThrow();
  }
});
