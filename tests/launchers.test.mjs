import { afterEach, expect, test } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures = [];
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture({ installed = true, configured = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'clair launchers '));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  if (installed) mkdirSync(join(root, 'node_modules'));
  for (const file of ['installer.cmd', 'demarrer.cmd', 'apercu.cmd', 'scripts/lancer.cmd'])
    copyFileSync(resolve(file), join(root, file));
  writeFileSync(join(root, '.env.example'), 'BILLING_MODE=demo\n');
  if (configured) writeFileSync(join(root, '.env'), 'EXISTING_CONFIGURATION=preserved\n');
  writeFileSync(
    join(root, 'bin/npm.cmd'),
    '@echo off\r\n>>"%~dp0npm-calls.txt" echo %*\r\nif "%CLAIR_TEST_FAIL%"=="%*" exit /b 7\r\nexit /b 0\r\n',
  );
  return root;
}

function run(root, launcher, fail = '') {
  // Start outside the project, with spaces in its path, as with an Explorer shortcut.
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  const result = spawnSync(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', `call "${join(root, launcher)}"`],
    {
      cwd: tmpdir(),
      windowsVerbatimArguments: true,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...env,
        Path: join(root, 'bin') + ';' + process.env.PATH,
        CI: '1',
        CLAIR_TEST_FAIL: fail,
      },
    },
  );
  expect(result.error).toBeUndefined();
  return result;
}

const windowsTest = test.skipIf(process.platform !== 'win32');
windowsTest.each([
  ['installer.cmd', ['ci']],
  ['demarrer.cmd', ['run dev']],
  ['apercu.cmd', ['run build', 'run preview']],
])('%s invokes the expected commands and preserves configuration', (launcher, expected) => {
  const root = fixture();
  const result = run(root, launcher);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(readFileSync(join(root, 'bin/npm-calls.txt'), 'utf8').trim().split(/\r?\n/)).toEqual(
    expected,
  );
  expect(readFileSync(join(root, '.env'), 'utf8')).toBe('EXISTING_CONFIGURATION=preserved\n');
});

windowsTest('first launch installs dependencies and creates the local configuration', () => {
  const root = fixture({ installed: false, configured: false });
  expect(run(root, 'demarrer.cmd').status).toBe(0);
  expect(readFileSync(join(root, 'bin/npm-calls.txt'), 'utf8').trim().split(/\r?\n/)).toEqual([
    'ci',
    'run dev',
  ]);
  expect(readFileSync(join(root, '.env'), 'utf8')).toBe('BILLING_MODE=demo\n');
});

windowsTest.each([
  ['installer.cmd', 'ci'],
  ['demarrer.cmd', 'ci'],
  ['apercu.cmd', 'run build'],
])('%s stops after a failed %s command', (launcher, fail) => {
  const root = fixture({ installed: fail !== 'ci' });
  expect(run(root, launcher, fail).status).toBe(1);
  expect(readFileSync(join(root, 'bin/npm-calls.txt'), 'utf8').trim()).toBe(fail);
});
