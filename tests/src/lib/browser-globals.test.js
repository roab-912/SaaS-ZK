// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { Buffer, global, process as browserProcess } from '../../../src/lib/browser-globals.js';
test('minimal browser globals supply byte compatibility without a cryptographic shim', () => {
  expect(Buffer.from('Clair').toString('base64')).toBe('Q2xhaXI=');
  expect(global).toBe(globalThis);
  expect(browserProcess.browser).toBe(true);
  expect(browserProcess.env).toEqual({});
  expect(globalThis.Buffer).toBeDefined();
});
