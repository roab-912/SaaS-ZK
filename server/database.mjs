import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  // Idempotent v1 migration: preserves the tables and records of the original MVP.
  db.exec(
    "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL,customer TEXT UNIQUE,status TEXT NOT NULL DEFAULT 'inactive',expires INTEGER NOT NULL DEFAULT 0,subscription TEXT); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS circuits(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),hash TEXT NOT NULL,schema TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS proofs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),envelope TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS issuers(id TEXT PRIMARY KEY,name TEXT NOT NULL,jwk TEXT NOT NULL,approved INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS checkout_sessions(user_id TEXT PRIMARY KEY REFERENCES users(id),session_id TEXT NOT NULL); CREATE INDEX IF NOT EXISTS circuits_owner ON circuits(user_id); CREATE INDEX IF NOT EXISTS proofs_owner ON proofs(user_id); CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);",
  );
  // Additive v2 migration; existing users retain the essential plan.
  db.exec('BEGIN IMMEDIATE');
  try {
    if (
      !db
        .prepare('PRAGMA table_info(users)')
        .all()
        .some((c) => c.name === 'plan')
    )
      db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'essential'");
    if (
      !db
        .prepare('PRAGMA table_info(users)')
        .all()
        .some((c) => c.name === 'trial_expires')
    )
      db.exec('ALTER TABLE users ADD COLUMN trial_expires INTEGER NOT NULL DEFAULT 0');
    // Add an independent Stripe trial history flag; preserve the legacy column.
    if (
      !db
        .prepare('PRAGMA table_info(users)')
        .all()
        .some((c) => c.name === 'trial_used')
    )
      db.exec('ALTER TABLE users ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0');
    db.exec(
      'CREATE TABLE IF NOT EXISTS proof_usage(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),period TEXT NOT NULL,state TEXT NOT NULL,expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS proof_usage_owner ON proof_usage(user_id,period); PRAGMA user_version=3;',
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
