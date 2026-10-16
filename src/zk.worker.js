import { createEngineRegistry } from '../zk/registry.mjs';
import { executeZkOperation } from '../zk/operations.mjs';
import { noirBrowser } from '../zk/noir/browser.mjs';
import { circomBrowsers } from '../zk/circom/browser.mjs';
const registry = createEngineRegistry([noirBrowser, ...circomBrowsers], ['prove', 'verify']);
let running = false;
self.onmessage = async ({ data }) => {
  if (running) {
    self.postMessage({ type: 'error', message: 'Un calcul est déjà en cours.' });
    return;
  }
  running = true;
  try {
    const result = await executeZkOperation(data, registry, (message) =>
      self.postMessage({ type: 'progress', message }),
    );
    self.postMessage({ type: 'result', result });
  } catch {
    // Do not propagate provider errors: some contain private inputs or witnesses.
    self.postMessage({
      type: 'error',
      message:
        data?.mode === 'prove'
          ? 'Preuve impossible : vérifiez les conditions, les valeurs et les limites des calculs.'
          : 'Preuve invalide ou fichier incompatible.',
    });
  } finally {
    running = false;
  }
};
