import { test, expect } from 'vitest';
import { circomBrowsers } from '../../../zk/circom/browser.mjs';
import { PLONK_ENGINE, FFLONK_ENGINE } from '../../../shared/engines.mjs';
test('browser registers both protocol adapters with fixed versioned identities', () => {
  expect(circomBrowsers.map((a) => a.id)).toEqual([PLONK_ENGINE, FFLONK_ENGINE]);
  for (const adapter of circomBrowsers) {
    expect(adapter.prove).toBeTypeOf('function');
    expect(adapter.verify).toBeTypeOf('function');
  }
});
