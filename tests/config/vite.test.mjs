import { test, expect } from 'vitest';
import config from '../../vite.config.mjs';
test('build preserves ESM workers, WASM exclusions and cross-origin isolation', () => {
  expect(config.worker.format).toBe('es');
  expect(config.server.headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
  expect(config.optimizeDeps.exclude).toContain('@aztec/bb.js');
});
