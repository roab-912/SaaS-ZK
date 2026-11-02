const events = new Set([
  'auth.register',
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.revoke_sessions',
  'issuer.update',
  'billing.checkout',
  'billing.payment_method',
  'billing.change',
  'billing.renewal',
]);
export function createAuditLogger(logger = console, now = () => new Date()) {
  return (event, details = {}) => {
    if (!events.has(event)) throw Error('Unknown security event.');
    const record = { event: 'security', action: event, time: now().toISOString() };
    // Strict allowlist: never include credentials, request bodies, emails or Stripe secrets.
    for (const key of ['actorId', 'targetId'])
      if (
        typeof details[key] === 'string' &&
        details[key].length >= 1 &&
        details[key].length <= 64 &&
        !/[^a-zA-Z0-9-]/.test(details[key])
      )
        record[key] = details[key];
    if (typeof details.approved === 'boolean') record.approved = details.approved;
    if (
      typeof details.keyHash === 'string' &&
      details.keyHash.length === 64 &&
      !/[^a-f0-9]/.test(details.keyHash)
    )
      record.keyHash = details.keyHash;
    if (['essential', 'pro'].includes(details.plan)) record.plan = details.plan;
    logger.info?.(record);
  };
}
