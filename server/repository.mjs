import { randomBytes } from 'node:crypto';
const id = () => randomBytes(16).toString('hex');
export function createRepository(db) {
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
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
    setDemo: (userId, status, expires) =>
      run('UPDATE users SET status=?,expires=? WHERE id=?', status, expires, userId),
    setCustomer: (userId, customer) =>
      run('UPDATE users SET customer=? WHERE id=?', customer, userId),
    updateSubscription: (customer, status, expires, subscription) =>
      run(
        'UPDATE users SET status=?,expires=?,subscription=? WHERE customer=?',
        status,
        expires,
        subscription,
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
    saveCircuit(userId, hash, schema) {
      const existing = get('SELECT id FROM circuits WHERE user_id=? AND hash=?', userId, hash);
      if (existing) return { ...existing, hash, created: false };
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
    },
    deleteCircuit: (userId, circuitId) =>
      run('DELETE FROM circuits WHERE id=? AND user_id=?', circuitId, userId),
    listProofs: (userId) =>
      all(
        'SELECT id,envelope,created FROM proofs WHERE user_id=? ORDER BY created DESC',
        userId,
      ).map((r) => ({ ...r, envelope: JSON.parse(r.envelope) })),
    saveProof(userId, envelope) {
      const proofId = id();
      run(
        'INSERT INTO proofs VALUES(?,?,?,?)',
        proofId,
        userId,
        JSON.stringify(envelope),
        new Date().toISOString(),
      );
      return { id: proofId };
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
