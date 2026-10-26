import { test, expect } from 'vitest';
import { openDatabase } from '../../../server/database.mjs';
import { createRepository } from '../../../server/repository.mjs';
test('expired reservations and month rollover restore quota; deletion does not refund completed work', () => {
  const db = openDatabase(':memory:'),
    repo = createRepository(db);
  try {
    const u = repo.createUser('a@test.fr', 'hash');
    const first = repo.reserveProof(u.id, '2026-10', 0, 1);
    expect(() => repo.reserveProof(u.id, '2026-10', 1, 1)).toThrow('Quota');
    expect(() => repo.finishProof(u.id, first.token, true, 600001)).toThrow('expirée');
    const second = repo.reserveProof(u.id, '2026-10', 600001, 1);
    repo.finishProof(u.id, second.token, true, 600002);
    repo.finishProof(u.id, second.token, false, 600003);
    const archived = repo.saveProof(u.id, {}, 1);
    expect(() => repo.saveProof(u.id, {}, 1)).toThrow('Limite');
    repo.deleteProof(u.id, archived.id);
    expect(repo.usage(u.id, '2026-10', 600003)).toMatchObject({ generations: 1, proofs: 0 });
    expect(() => repo.reserveProof(u.id, '2026-11', 600004, 1)).not.toThrow();
  } finally {
    db.close();
  }
});
