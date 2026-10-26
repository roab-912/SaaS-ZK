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
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(3);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('migration upgrades the original v1 users table without losing records', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'clair-db-v1-')),
    path = join(dir, 'legacy.sqlite');
  let db = new DatabaseSync(path);
  try {
    db.exec(
      "CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL,customer TEXT UNIQUE,status TEXT NOT NULL DEFAULT 'inactive',expires INTEGER NOT NULL DEFAULT 0,subscription TEXT); PRAGMA user_version=1;",
    );
    db.prepare(
      'INSERT INTO users(id,email,password,created,status,expires) VALUES(?,?,?,?,?,?)',
    ).run('old', 'old@test.fr', 'original-digest', 'original-date', 'active', 1000);
    db.close();
    db = openDatabase(path);
    expect(db.prepare('SELECT * FROM users WHERE id=?').get('old')).toMatchObject({
      email: 'old@test.fr',
      password: 'original-digest',
      status: 'active',
      expires: 1000,
      plan: 'essential',
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM proof_usage').get().count).toBe(0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
