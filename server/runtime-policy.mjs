// Reviewed against nodejs/Release and nodejs.org/dist on 30/10/2026.
// Bump these floors when Node publishes security updates.
export const NODE_POLICY = [
  { minimum: [22, 23, 4], lts: '2024-10-29', end: '2027-04-30' },
  { minimum: [24, 22, 2], lts: '2025-10-28', end: '2028-04-30' },
  { minimum: [26, 13, 0], lts: '2026-10-28', end: '2029-04-30' },
];
export function assertSupportedRuntime(version, now = new Date()) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  const parts = match?.slice(1).map(Number),
    day = now.toISOString().slice(0, 10);
  const branch = parts && NODE_POLICY.find((b) => b.minimum[0] === parts[0]);
  const patched =
    branch &&
    (parts[1] > branch.minimum[1] ||
      (parts[1] === branch.minimum[1] && parts[2] >= branch.minimum[2]));
  if (!branch || !patched || day < branch.lts || day >= branch.end)
    throw Error(
      'Node.js non pris en charge pour la production ou une distribution. Installez une version LTS corrigée (voir .node-version et docs/SECURITY.md).',
    );
}
