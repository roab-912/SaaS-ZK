import { test, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assertCompileDirectory } from '../../../zk/noir/compile-path.mjs';
test('compiler filesystem operations remain inside the task temporary directory', () => {
  expect(assertCompileDirectory(join(tmpdir(), 'clair-noir-ABC123'))).toBe(
    resolve(tmpdir(), 'clair-noir-ABC123'),
  );
  for (const p of [
    tmpdir(),
    join(tmpdir(), 'other-ABC123'),
    join(tmpdir(), 'clair-noir-ABC123', '..'),
    resolve('clair-noir-ABC123'),
  ])
    expect(() => assertCompileDirectory(p)).toThrow();
});
