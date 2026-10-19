import { test, expect } from 'vitest';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { createNoirRuntime } from '../zk/noir/runtime.mjs';
import { circomBrowsers } from '../zk/circom/browser.mjs';
import { compileCircuit } from '../server/compiler.mjs';
import { ENGINE, PLONK_ENGINE, FFLONK_ENGINE } from '../shared/engines.mjs';
import { contextField, parseProof } from '../shared/proof.mjs';
import { witnessFixture } from './helpers/circom.mjs';
const circuit = (engine) => ({
  version: 2,
  engine,
  name: 'Comparaison privée',
  description: '',
  inputs: ['x', 'y'].map((id) => ({
    id,
    label: id,
    type: 'number',
    visibility: 'private',
    source: 'declared',
  })),
  root: { kind: 'op', op: 'gte', args: ['x', 'y'].map((id) => ({ kind: 'input', id })) },
});
const noir = createNoirRuntime({
  Noir,
  Backend: UltraHonkBackend,
  encode: (bytes) => Buffer.from(bytes).toString('base64'),
  decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
});
test.each([ENGINE, PLONK_ENGINE, FFLONK_ENGINE])(
  'v2 %s proves true and false and rejects a forged result',
  { timeout: 180000 },
  async (engine) => {
    const c = circuit(engine),
      compiled = await compileCircuit(c),
      adapter = engine === ENGINE ? noir : circomBrowsers.find((a) => a.id === engine);
    for (const [values, result] of [
      [{ x: 5, y: 8 }, false],
      [{ x: 8, y: 8 }, true],
    ]) {
      const envelope = await adapter.prove({ circuit: c, compiled, values });
      expect(parseProof(envelope)).toMatchObject({
        format: 'clair-proof/2',
        result,
        publicData: [],
      });
      expect(envelope.publicInputs).toHaveLength(2);
      expect(await adapter.verify({ envelope, compiled })).toEqual({ valid: true });
      const changed = structuredClone(envelope);
      changed.result = !result;
      expect(() => parseProof(changed)).toThrow(/résultat/);
      changed.publicInputs[1] = result ? '0x0' : '0x1';
      expect(parseProof(changed).result).toBe(!result);
      expect(await adapter.verify({ envelope: changed, compiled })).toEqual({ valid: false });
    }
  },
);
test(
  'result is independently constrained in both circuit implementations',
  { timeout: 60000 },
  async () => {
    const c = circuit(ENGINE),
      compiled = await compileCircuit(c),
      executor = new Noir(compiled.artifact);
    const inputs = { context: contextField(compiled.hash), in_0: '5', in_1: '8' };
    await executor.execute({ ...inputs, result: false });
    await expect(executor.execute({ ...inputs, result: true })).rejects.toThrow();
    const fixture = await witnessFixture(circuit(PLONK_ENGINE));
    try {
      await fixture.calculate({ in_0: '5', in_1: '8', result: '0' });
      await expect(fixture.calculate({ in_0: '5', in_1: '8', result: '1' })).rejects.toThrow();
      await expect(fixture.calculate({ in_0: '5', in_1: '8', result: '2' })).rejects.toThrow();
      await expect(
        fixture.calculate({ in_0: '4294967296', in_1: '8', result: '1' }),
      ).rejects.toThrow();
    } finally {
      await fixture.close();
    }
  },
);

test.each([ENGINE, PLONK_ENGINE, FFLONK_ENGINE])(
  'signed public input is bound to the real %s proof',
  { timeout: 180000 },
  async (engine) => {
    const { signedFixture } = await import('./helpers/attestation.mjs');
    const { executeZkOperation } = await import('../zk/operations.mjs');
    const { createEngineRegistry } = await import('../zk/registry.mjs');
    const f = await signedFixture();
    f.circuit.engine = engine;
    const compiled = await compileCircuit(f.circuit),
      adapter = engine === ENGINE ? noir : circomBrowsers.find((a) => a.id === engine),
      registry = createEngineRegistry([adapter], ['prove', 'verify']);
    const envelope = await executeZkOperation({ mode: 'prove', ...f, compiled }, registry);
    expect(envelope.format).toBe('clair-proof/3');
    expect(envelope.publicData[0].value).toBe(3000);
    expect(envelope.attestations[0].attestation).toEqual(f.attestation);
    const verify = (changed) =>
      executeZkOperation(
        { mode: 'verify', envelope: changed, compiled, issuers: f.issuers },
        registry,
      );
    expect(await verify(envelope)).toMatchObject({
      valid: true,
      proofValid: true,
      sources: [{ valid: true, issuerId: 'source-1' }],
    });
    const tampered = structuredClone(envelope);
    tampered.attestations[0].attestation.signature = 'A'.repeat(86);
    expect(await verify(tampered)).toMatchObject({
      valid: false,
      proofValid: true,
      sources: [{ signatureValid: false }],
    });
    expect(
      await executeZkOperation({ mode: 'verify', envelope, compiled, issuers: [] }, registry),
    ).toMatchObject({ valid: false, proofValid: true, sources: [{ approved: false }] });
    const changed = structuredClone(envelope);
    changed.publicInputs[2] = '0xfa0';
    changed.publicData[0].value = 4000;
    await expect(verify(changed)).rejects.toThrow();
    await expect(
      executeZkOperation({ mode: 'prove', ...f, compiled, issuers: [] }, registry),
    ).rejects.toThrow();
  },
);
