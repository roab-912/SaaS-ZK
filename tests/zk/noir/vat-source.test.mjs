import { test, expect } from 'vitest';
import { Noir } from '@noir-lang/noir_js';
import { compileNoir } from '../../../zk/noir/compiler.mjs';
import { vatWitness } from '../../../zk/noir/vat-runtime.mjs';
import { normalizeInputs } from '../../../zk/noir/runtime.mjs';
import { contextField } from '../../../shared/proof.mjs';
import { vatFixture } from '../../helpers/vat.mjs';
import { BarretenbergSync, Fr } from '@aztec/bb.js';
import { VAT_DOMAIN, VAT_FIELD, vatHex, vatCircuit } from '../../../shared/vat.mjs';
import { createHash } from 'node:crypto';
import { vatNoirSource } from '../../../zk/noir/vat-source.mjs';

test('all original VAT programs retain their exact source for existing proofs', () => {
  // SHA-256 of the released source with context hash aaaa… (before program v2).
  const hashes = {
    10: '04734a12768e75b297ace12c2bc65e6df1908ec51d95dcd068d7bc86348c7d1e',
    50: 'be65611a4a6fd9203b883c53086a81df212611c23df74ed34320e16a539b2c39',
    100: '3e82602e688fbbae99a623468dae1fdcad1ebec78c441b555ce1b1fdda21811e',
    250: 'ec739168cf3d56cdf11c68b4a15f08eb00674cad5ca0960ddcf69c4aa9144e87',
    500: '011d8964ff0c2e1e30c47241e468f485878bc6628d12f4890793878e03c06aa0',
  };
  for (const [capacity, expected] of Object.entries(hashes)) {
    const source = vatNoirSource(vatCircuit(Number(capacity), 1), 'a'.repeat(64));
    expect(createHash('sha256').update(source).digest('hex')).toBe(expected);
  }
});

// Rebind the input commitment to distinguish semantic constraints from integrity checks.
async function rebind(w) {
  const api = await BarretenbergSync.initSingleton();
  const hash = (values) =>
    vatHex(BigInt(api.poseidon2Hash(values.map((v) => new Fr(BigInt(v)))).toString()));
  let chain = hash([VAT_DOMAIN, w.company_hash, w.in_0, w.in_1, w.in_2, w.blinding]);
  let sales = 0,
    credits = 0;
  for (let i = 0; i < Number(w.in_2); i++) {
    chain = hash([chain, hash([...w.metadata[i], ...w.rows[i]]), i + 1]);
    const tax = w.rows[i].slice(7).reduce((sum, value) => sum + Number(value), 0);
    if (w.rows[i][1] === '1') credits += tax;
    else sales += tax;
  }
  const count = Number(w.in_2);
  const order = [
    ...Array.from({ length: count }, (_, i) => i).sort((a, b) =>
      BigInt(w.metadata[a][0]) < BigInt(w.metadata[b][0]) ? -1 : 1,
    ),
    ...Array.from({ length: w.rows.length - count }, (_, i) => count + i),
  ].map(String);
  return { ...w, order, commitment: chain, in_3: String(sales), in_4: String(credits) };
}
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
      w.rows[0][0] = '20261001';
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
    (w) => {
      [w.rows[0], w.rows[1]] = [w.rows[1], w.rows[0]];
      [w.metadata[0], w.metadata[1]] = [w.metadata[1], w.metadata[0]];
    },
    (w) => {
      w.company_hash = '1';
    },
    (w) => {
      w.in_4 = '1';
    },
    (w) => {
      w.metadata[2][0] = '1';
    },
    (w) => {
      w.order[1] = w.order[0];
    },
    (w) => {
      w.order[0] = '10';
    },
    (w) => {
      [w.order[0], w.order[1]] = [w.order[1], w.order[0]];
    },
    (w) => {
      [w.order[0], w.order[2]] = [w.order[2], w.order[0]];
    },
    (w) => {
      w.order[9] = w.order[8];
    },
  ];
  for (const change of attacks) {
    const w = structuredClone(witness);
    change(w);
    await expect(noir.execute(w)).rejects.toThrow();
  }
});

test(
  'v2 rejects duplicate identifiers even under a matching commitment; legacy semantics remain verifiable',
  { timeout: 60000 },
  async () => {
    const f = await vatFixture(2, true);
    const current = await compileNoir(f.circuit);
    const legacy = await compileNoir(vatCircuit(10, 1));
    const witness = {
      context: contextField(current.hash),
      result: true,
      ...normalizeInputs(f.circuit, f.values),
      ...(await vatWitness(f.batch, 10)),
    };
    // Same identifier with different amounts must also be rejected.
    witness.metadata[1][0] = witness.metadata[0][0];
    const duplicate = await rebind(witness);
    await expect(new Noir(current.artifact).execute(duplicate)).rejects.toThrow();
    await new Noir(legacy.artifact).execute({ ...duplicate, context: contextField(legacy.hash) });
    // Duplicating the full piece, including its amount, is rejected independently of the sum.
    witness.rows[1] = [...witness.rows[0]];
    witness.metadata[1] = [...witness.metadata[0]];
    await expect(new Noir(current.artifact).execute(await rebind(witness))).rejects.toThrow();
    // Full capacity, no padding: equal amounts are fine, and IDs retain all field bits.
    const full = structuredClone(witness);
    full.in_2 = '10';
    const ids = [VAT_FIELD - 1n, 1n, (1n << 128n) + 1n, (1n << 252n) + 1n, 2n, 9n, 3n, 8n, 4n, 7n];
    for (let i = 0; i < 10; i++) {
      full.rows[i] = [...witness.rows[0]];
      full.metadata[i] = [vatHex(ids[i]), ...witness.metadata[0].slice(1)];
    }
    await new Noir(current.artifact).execute(await rebind(full));
    full.metadata[9][0] = full.metadata[0][0];
    await expect(new Noir(current.artifact).execute(await rebind(full))).rejects.toThrow();
    expect(current.hash).not.toBe(legacy.hash);
  },
);

test('dates, taxes, credit references and exemption metadata are constrained even if the commitment matches', async () => {
  const f = await vatFixture(2, true);
  const compiled = await compileNoir(f.circuit),
    noir = new Noir(compiled.artifact);
  const base = {
    context: contextField(compiled.hash),
    result: true,
    ...normalizeInputs(f.circuit, f.values),
    ...(await vatWitness(f.batch, 10)),
  };
  base.rows[0][0] = '20260901';
  base.rows[1][0] = '20260930';
  await noir.execute(await rebind(base));
  for (const change of [
    (w) => {
      w.rows[0][0] = '20260831';
    },
    (w) => {
      w.rows[1][0] = '20261001';
    },
    (w) => {
      w.rows[0][0] = '20260931';
    },
    (w) => {
      w.rows[1][8] = '0';
    },
    (w) => {
      w.rows[1][1] = '2';
    },
    (w) => {
      w.rows[1][1] = '1';
    },
    (w) => {
      w.rows[1][1] = '1';
      w.metadata[1][1] = w.metadata[1][0];
    },
    (w) => {
      w.metadata[0][2] = '0';
    },
  ]) {
    const w = structuredClone(base);
    change(w);
    await expect(noir.execute(await rebind(w))).rejects.toThrow();
  }
});
