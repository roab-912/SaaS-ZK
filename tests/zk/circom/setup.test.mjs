import { test, expect } from 'vitest';
import { setupCircuit } from '../../../zk/circom/setup.mjs';
test('setup entry point rejects arbitrary protocol names before running any compiler', async () => {
  await expect(setupCircuit('unused', 'constructor', 'unused')).rejects.toThrow(/Unsupported/);
});
