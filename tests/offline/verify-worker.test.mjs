import { test, expect } from 'vitest';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
test('worker errors never echo imported proof contents', async () => {
  const worker = fork(
    fileURLToPath(new URL('../../offline/verify-worker.mjs', import.meta.url)),
    [],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true },
  );
  worker.send({ proof: { secret: 'do-not-echo' }, snapshot: {} });
  try {
    const [message] = await once(worker, 'message');
    expect(message.error).toContain('Vérification impossible');
    expect(JSON.stringify(message)).not.toContain('do-not-echo');
  } finally {
    worker.kill();
  }
});
