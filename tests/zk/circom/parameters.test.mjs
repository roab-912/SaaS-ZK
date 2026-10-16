import { test, expect, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createParameterLoader,
  PARAMETERS,
  validParameters,
  loadParameters,
} from '../../../zk/circom/parameters.mjs';
test(
  'official parameters match the pinned hash and cached loader avoids network',
  { timeout: 180000 },
  async () => {
    const target = await loadParameters();
    expect(validParameters(await readFile(target))).toBe(true);
    const fetcher = vi.fn();
    const load = createParameterLoader({ directory: join(target, '..'), fetcher });
    expect(await load()).toBe(target);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
test('corrupt or oversized downloads are rejected and failures can be retried', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clair-parameters-'));
  try {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('untrusted'))
      .mockResolvedValueOnce(
        new Response('too large', {
          headers: { 'content-length': String(PARAMETERS.maxBytes + 1) },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        body: {
          async *[Symbol.asyncIterator]() {
            yield { length: PARAMETERS.maxBytes + 1 };
          },
        },
      });
    const load = createParameterLoader({ directory, fetcher });
    await expect(load()).rejects.toThrow(/Intégrité/);
    await expect(load()).rejects.toThrow(/volumineux/);
    await expect(load()).rejects.toThrow(/indisponibles/);
    await expect(load()).rejects.toThrow(/volumineux/);
    expect(fetcher).toHaveBeenCalledTimes(4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
