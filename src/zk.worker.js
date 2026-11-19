import { isProofStage } from '../shared/proof-progress.mjs';
import { prepareVatDraft } from '../zk/noir/vat-runtime.mjs';
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
  const originalFetch = self.fetch;
  try {
    // bb.js uses fixed URLs for public CRS points. The demonstration ships these
    // same points on this origin. Preserve Range so the engine gets its prefix.
    if (data?.mode === 'prove' && /^kit-[A-Za-z0-9]+$/.test(data.demoKit ?? '')) {
      self.fetch = (url, options) => {
        if (
          url === 'https://crs.aztec.network/g1.dat' ||
          url === 'https://crs.aztec.network/g2.dat'
        )
          return originalFetch.call(
            self,
            '/demo-tva/' + data.demoKit + '/' + new URL(url).pathname.slice(1),
            options,
          );
        return originalFetch.call(self, url, options);
      };
    }
    const result =
      data?.mode === 'vat-commit'
        ? await prepareVatDraft(data.draft)
        : await executeZkOperation(data, registry, (message, stage) =>
            self.postMessage({
              type: 'progress',
              message,
              ...(isProofStage(stage) ? { stage } : {}),
            }),
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
    self.fetch = originalFetch;
    running = false;
  }
};
