import { test, expect } from 'vitest';
import config from '../../vite.config.mjs';
test('build preserves ESM workers, WASM exclusions and cross-origin isolation', () => {
  expect(config.worker.format).toBe('es');
  expect(config.server?.headers).toBeUndefined();
  expect(config.optimizeDeps.exclude).toContain('@aztec/bb.js');
});

test('development file serving is restricted to browser source and trusted dependencies', () => {
  expect(config.server.fs.strict).toBe(true);
  expect(config.server.fs.allow.some((p) => p.endsWith('/src'))).toBe(true);
  expect(config.server.fs.allow.some((p) => p.endsWith('/server') || p.endsWith('/data'))).toBe(
    false,
  );
  expect(config.server.fs.deny).toContain('**/*.clair');
});
