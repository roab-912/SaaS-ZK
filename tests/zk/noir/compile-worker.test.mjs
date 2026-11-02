import { test, expect } from 'vitest';
import { compileSource } from '../../../zk/noir/compile-worker.mjs';
test('the compiler subprocess refuses arbitrary directories', async () => {
  await expect(compileSource('.')).rejects.toThrow(/directory/);
});
