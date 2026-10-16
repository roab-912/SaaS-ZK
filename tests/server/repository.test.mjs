import { test, expect } from 'vitest';
import { openDatabase } from '../../server/database.mjs';
import { createRepository } from '../../server/repository.mjs';
test('repository owns serialization, deduplication and user boundaries', () => {
  const db = openDatabase(':memory:'),
    repo = createRepository(db);
  try {
    const a = repo.createUser('a@example.test', 'digest'),
      b = repo.createUser('b@example.test', 'digest');
    const c = repo.saveCircuit(a.id, 'hash', { version: 1 });
    expect(repo.saveCircuit(a.id, 'hash', {}).id).toBe(c.id);
    repo.deleteCircuit(b.id, c.id);
    expect(repo.listCircuits(a.id)).toHaveLength(1);
    expect(repo.listCircuits(b.id)).toEqual([]);
    const p = repo.saveProof(a.id, { proof: 'test' });
    repo.deleteProof(b.id, p.id);
    expect(repo.listProofs(a.id)[0].envelope.proof).toBe('test');
    repo.deleteProof(a.id, p.id);
    expect(repo.listProofs(a.id)).toEqual([]);
    repo.setCustomer(a.id, 'cus');
    repo.updateSubscription('cus', 'active', 100, 'sub');
    expect(repo.userById(a.id).subscription).toBe('sub');
    repo.setCheckout(a.id, 'cs');
    expect(repo.getCheckout(a.id)).toBe('cs');
    repo.createSession('expired', a.id, 1, 0);
    repo.createSession('valid', a.id, 200, 10);
    expect(repo.userForSession('expired', 10)).toBeUndefined();
    expect(repo.userForSession('valid', 20).id).toBe(a.id);
    repo.deleteSession('valid');
    expect(repo.userForSession('valid', 20)).toBeUndefined();
    repo.saveIssuer({ id: 'issuer', name: 'Issuer', jwk: { kty: 'EC' }, approved: true });
    expect(repo.listIssuers()).toHaveLength(1);
    repo.saveIssuer({ id: 'issuer', name: 'Issuer', jwk: { kty: 'EC' }, approved: false });
    expect(repo.listIssuers()).toEqual([]);
    repo.deleteCircuit(a.id, c.id);
    expect(repo.listCircuits(a.id)).toEqual([]);
  } finally {
    db.close();
  }
});
