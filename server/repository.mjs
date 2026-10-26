import { randomBytes } from 'node:crypto';
import { fail } from './errors.mjs';
const id = () => randomBytes(16).toString('hex');
export function createRepository(db) {
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const atomic = (work) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const count = (table, userId) =>
    get('SELECT COUNT(*) AS count FROM ' + table + ' WHERE user_id=?', userId).count;
  const usage = (userId, period, now) =>
    get(
      "SELECT COUNT(*) AS used, COALESCE(SUM(state='pending'),0) AS pending FROM proof_usage WHERE user_id=? AND period=? AND (state='complete' OR expires>?)",
      userId,
      period,
      now,
    );
  return {
    userById: (userId) => get('SELECT * FROM users WHERE id=?', userId),
    updatePassword: (userId, previous, next) =>
      run('UPDATE users SET password=? WHERE id=? AND password=?', next, userId, previous),
    userByEmail: (email) => get('SELECT * FROM users WHERE email=?', email),
    createUser(email, password) {
      const userId = id();
      run(
        'INSERT INTO users(id,email,password,created) VALUES(?,?,?,?)',
        userId,
        email,
        password,
        new Date().toISOString(),
      );
      return this.userById(userId);
    },
    userForSession: (token, now) =>
      get(
        'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?',
        token,
        now,
      ),
    createSession(token, userId, expires, now) {
      run('DELETE FROM sessions WHERE expires<?', now);
      run('INSERT INTO sessions VALUES(?,?,?)', token, userId, expires);
    },
    deleteSession: (token) => run('DELETE FROM sessions WHERE token=?', token),

    markTrialUsed: (customer) => run('UPDATE users SET trial_used=1 WHERE customer=?', customer),
    setCustomer: (userId, customer) =>
      run('UPDATE users SET customer=? WHERE id=?', customer, userId),
    updateSubscription: (customer, status, expires, subscription, plan = 'essential') =>
      run(
        'UPDATE users SET status=?,expires=?,subscription=?,plan=? WHERE customer=?',
        status,
        expires,
        subscription,
        plan,
        customer,
      ),
    getCheckout: (userId) =>
      get('SELECT session_id FROM checkout_sessions WHERE user_id=?', userId)?.session_id,
    setCheckout: (userId, sessionId) =>
      run(
        'INSERT INTO checkout_sessions VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET session_id=excluded.session_id',
        userId,
        sessionId,
      ),
    listCircuits: (userId) =>
      all(
        'SELECT id,hash,schema,created FROM circuits WHERE user_id=? ORDER BY created DESC',
        userId,
      ).map((r) => ({ ...r, schema: JSON.parse(r.schema) })),
    saveCircuit(userId, hash, schema, limit = Infinity) {
      return atomic(() => {
        const existing = get('SELECT id FROM circuits WHERE user_id=? AND hash=?', userId, hash);
        if (existing) return { ...existing, hash, created: false };
        if (count('circuits', userId) >= limit)
          throw fail(409, 'Limite de circuits atteinte. Supprimez un circuit ou changez d’offre.');
        const circuitId = id();
        run(
          'INSERT INTO circuits VALUES(?,?,?,?,?)',
          circuitId,
          userId,
          hash,
          JSON.stringify(schema),
          new Date().toISOString(),
        );
        return { id: circuitId, hash, created: true };
      });
    },
    deleteCircuit: (userId, circuitId) =>
      run('DELETE FROM circuits WHERE id=? AND user_id=?', circuitId, userId),
    listProofs: (userId) =>
      all(
        'SELECT id,envelope,created FROM proofs WHERE user_id=? ORDER BY created DESC',
        userId,
      ).map((r) => ({ ...r, envelope: JSON.parse(r.envelope) })),
    saveProof(userId, envelope, limit = Infinity) {
      return atomic(() => {
        if (count('proofs', userId) >= limit)
          throw fail(
            409,
            'Limite de preuves archivées atteinte. Supprimez une archive ou changez d’offre.',
          );
        const proofId = id();
        run(
          'INSERT INTO proofs VALUES(?,?,?,?)',
          proofId,
          userId,
          JSON.stringify(envelope),
          new Date().toISOString(),
        );
        return { id: proofId };
      });
    },
    usage(userId, period, now) {
      const generations = usage(userId, period, now);
      return {
        circuits: count('circuits', userId),
        proofs: count('proofs', userId),
        generations: generations.used - generations.pending,
        pending: generations.pending,
      };
    },
    reserveProof(userId, period, now, limit) {
      return atomic(() => {
        run("DELETE FROM proof_usage WHERE state='pending' AND expires<=?", now);
        if (usage(userId, period, now).used >= limit)
          throw fail(
            409,
            'Quota mensuel de générations atteint. Attendez le mois suivant ou changez d’offre.',
          );
        const token = id();
        run(
          "INSERT INTO proof_usage VALUES(?,?,?,'pending',?)",
          token,
          userId,
          period,
          now + 10 * 60000,
        );
        return { token };
      });
    },
    finishProof(userId, token, complete, now) {
      if (complete) {
        const result = run(
          "UPDATE proof_usage SET state='complete' WHERE token=? AND user_id=? AND (state='complete' OR expires>?)",
          token,
          userId,
          now,
        );
        if (!result.changes)
          throw fail(409, 'Autorisation expirée ou inconnue. Relancez la génération.');
      } else
        run(
          "DELETE FROM proof_usage WHERE token=? AND user_id=? AND state='pending'",
          token,
          userId,
        );
    },
    adminStats(now, period) {
      return {
        users: get('SELECT COUNT(*) AS count FROM users').count,
        activeSubscriptions: get(
          "SELECT COUNT(*) AS count FROM users WHERE subscription IS NOT NULL AND status IN ('active','trialing') AND expires>?",
          now,
        ).count,
        circuits: get('SELECT COUNT(*) AS count FROM circuits').count,
        proofs: get('SELECT COUNT(*) AS count FROM proofs').count,
        generations: get(
          "SELECT COUNT(*) AS count FROM proof_usage WHERE state='complete' AND period=?",
          period,
        ).count,
        subscriptions: all(
          "SELECT plan, COUNT(*) AS count FROM users WHERE subscription IS NOT NULL AND status IN ('active','trialing') AND expires>? GROUP BY plan",
          now,
        ),
        statuses: all('SELECT status,COUNT(*) AS count FROM users GROUP BY status'),
      };
    },
    deleteProof: (userId, proofId) =>
      run('DELETE FROM proofs WHERE id=? AND user_id=?', proofId, userId),
    listIssuers: () =>
      all('SELECT id,name,jwk FROM issuers WHERE approved=1').map((r) => ({
        ...r,
        jwk: JSON.parse(r.jwk),
      })),
    saveIssuer: (row) =>
      run(
        'INSERT INTO issuers VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,jwk=excluded.jwk,approved=excluded.approved',
        row.id,
        row.name,
        JSON.stringify(row.jwk),
        Number(row.approved),
      ),
  };
}
