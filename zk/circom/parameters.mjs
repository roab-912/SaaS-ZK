import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// BLAKE2b-512 pinned from the official PSE contribution 0080, degree 16 file.
// Provenance and transcript verification are recorded in docs/ENGINES.md.
export const PARAMETERS = Object.freeze({
  url: 'https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_16.ptau',
  digest:
    '9532c6c04a21335577713724b6d46c266a93aa621b78882b8b64b26f3080a8f0d974aded00c4d781adbdf493a45c51db455108f7aeedb49971569d57a56971c3',
  maxBytes: 90 * 1024 * 1024,
});
export const validParameters = (bytes) =>
  bytes.length <= PARAMETERS.maxBytes &&
  createHash('blake2b512').update(bytes).digest('hex') === PARAMETERS.digest;
export function createParameterLoader({
  directory = resolve('data/zk-parameters'),
  fetcher = fetch,
} = {}) {
  let pending;
  return () =>
    (pending ??= (async () => {
      await mkdir(directory, { recursive: true });
      const target = join(directory, 'ppot0080-16.ptau');
      try {
        if (validParameters(await readFile(target))) return target;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      const response = await fetcher(PARAMETERS.url, {
        signal: AbortSignal.timeout(120000),
        redirect: 'error',
      });
      if (!response.ok || !response.body) throw Error('Paramètres publics indisponibles.');
      if (Number(response.headers.get('content-length')) > PARAMETERS.maxBytes) {
        await response.body.cancel();
        throw Error('Paramètres publics trop volumineux.');
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > PARAMETERS.maxBytes) throw Error('Paramètres publics trop volumineux.');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (!validParameters(bytes)) throw Error('Intégrité des paramètres publics incorrecte.');
      const temp = target + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, bytes, { flag: 'wx' });
        await rename(temp, target);
      } finally {
        await rm(temp, { force: true });
      }
      return target;
    })().catch((error) => {
      pending = undefined;
      throw error;
    }));
}
export const loadParameters = createParameterLoader();
