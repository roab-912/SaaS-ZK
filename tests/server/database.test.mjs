import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../server/database.mjs';
test('idempotent schema preserves accounts and enforces foreign keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clair-db-test-')),
    path = join(dir, 'nested', 'test.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare('INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)').run(
      'a',
      'a@test.fr',
      'legacy',
      'today',
    );
    expect(() => db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('x', 'absent', 1)).toThrow();
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT email FROM users WHERE id=?').get('a').email).toBe('a@test.fr');
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
