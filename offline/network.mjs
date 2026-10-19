// A portable verifier never downloads resources, including in inherited worker threads.
export function denyNetwork() {
  const blocked = () => {
    throw Error('Accès réseau interdit dans le vérificateur hors ligne.');
  };
  globalThis.fetch = blocked;
}
denyNetwork();
