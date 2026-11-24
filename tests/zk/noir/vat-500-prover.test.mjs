import { afterEach, expect, test, vi } from 'vitest';
import { gzipSync } from 'fflate';
import { Barretenberg } from '@aztec/bb.js';
import * as ubl from '../../../shared/ubl.mjs';
import key from '../../../zk/noir/vat-500-v2-vk.json' with { type: 'json' };
import { proveLargeVat } from '../../../zk/noir/vat-500-prover.mjs';

const compressed = gzipSync(Uint8Array.of(1, 2, 3));
const compiled = {
  hash: key.circuitHash,
  artifact: { bytecode: Buffer.from(compressed).toString('base64') },
};
afterEach(() => vi.restoreAllMocks());

test('uses the regular prover for an unrecognised circuit or bytecode', async () => {
  const start = vi.spyOn(Barretenberg, 'new');
  expect(await proveLargeVat({ hash: 'other' }, compressed, 4, vi.fn())).toBeNull();
  expect(await proveLargeVat(compiled, compressed, 4, vi.fn())).toBeNull();
  expect(start).not.toHaveBeenCalled();
});

test('checks the whole proof with the pinned public key and releases the private witness on failure', async () => {
  vi.spyOn(ubl, 'sha256Hex').mockResolvedValue(key.acirSha256);
  const combined = new Uint8Array(512);
  const api = {
    acirInitSRS: vi.fn(),
    acirProveUltraKeccakZKHonk: vi.fn().mockResolvedValue(combined),
    acirVerifyUltraKeccakZKHonk: vi.fn().mockResolvedValue(false),
    destroy: vi.fn(),
  };
  vi.spyOn(Barretenberg, 'new').mockResolvedValue(api);
  const checking = vi.fn();
  await expect(proveLargeVat(compiled, compressed, 4, checking)).rejects.toThrow(/vérification/);
  expect(checking).toHaveBeenCalledOnce();
  const [checked, vk] = api.acirVerifyUltraKeccakZKHonk.mock.calls[0];
  expect(checked).toBe(combined);
  expect(Buffer.from(vk).toString('base64')).toBe(key.vkBase64);
  expect([...api.acirProveUltraKeccakZKHonk.mock.calls[0][1]]).toEqual([0, 0, 0]);
  expect(api.destroy).toHaveBeenCalledOnce();
});
