import { api } from './api.js';
import { ENGINE } from '../../shared/proof.mjs';
export function compileForEngine(circuit, engine = circuit.engine ?? ENGINE, signal) {
  return api('/compile?engine=' + encodeURIComponent(engine), circuit, 'POST', { signal });
}
export function launchProof(
  payload,
  onProgress = () => {},
  {
    createWorker = () =>
      new Worker(new URL('../zk.worker.js', import.meta.url), { type: 'module' }),
    timeout = 300000,
  } = {},
) {
  let worker,
    timer,
    settled = false,
    finish;
  const promise = new Promise((resolve, reject) => {
    finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
      error ? reject(error) : resolve(result);
    };
    try {
      worker = createWorker();
      timer = setTimeout(
        () =>
          finish(Error('Calcul interrompu après cinq minutes. Réduisez la complexité du circuit.')),
        timeout,
      );
      worker.onmessage = ({ data }) => {
        if (settled) return;
        if (data?.type === 'progress') {
          onProgress(data.message);
          return;
        }
        if (data?.type === 'result') finish(null, data.result);
        else
          finish(
            Error(data?.type === 'error' ? data.message : 'Réponse du moteur local invalide.'),
          );
      };
      worker.onerror = () =>
        finish(
          Error(
            'Le moteur local n’a pas pu démarrer. Vérifiez la mémoire disponible et rechargez la page.',
          ),
        );
      worker.onmessageerror = () => finish(Error('Réponse du moteur local illisible.'));
      worker.postMessage(payload);
    } catch {
      finish(Error('Le moteur local n’a pas pu démarrer.'));
    }
  });
  return { promise, cancel: () => finish(Error('Calcul annulé.')) };
}
