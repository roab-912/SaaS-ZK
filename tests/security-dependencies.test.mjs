import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
test('generic crypto polyfills are absent and cryptographic proof engines stay pinned', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  for (const name of [
    'elliptic',
    'crypto-browserify',
    'node-stdlib-browser',
    'vite-plugin-node-polyfills',
  ])
    expect(lock.packages['node_modules/' + name]).toBeUndefined();
  expect(manifest.dependencies['@aztec/bb.js']).toBe('0.87.0');
  expect(manifest.dependencies['@noir-lang/noir_js']).toBe('1.0.0-beta.9');
});

test('the updated glob matcher preserves legacy filelist matching used by the toolchain', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { FileList } = require('filelist');
  const files = new FileList();
  files.include('server/*.mjs');
  expect(files.toArray()).toContain('server/app.mjs');
  expect(files.toArray().every((p) => p.startsWith('server/') && p.endsWith('.mjs'))).toBe(true);
});
