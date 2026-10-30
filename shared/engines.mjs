export const ENGINE = 'noir-beta9-ultrahonk-0.87';
export const PLONK_ENGINE = 'circom223-snarkjs076-plonk-v1';
export const FFLONK_ENGINE = 'circom223-snarkjs076-fflonk-v1';
export const ZK_ENGINES = Object.freeze([
  Object.freeze({
    id: ENGINE,
    name: 'Noir / UltraHonk',
    privateSignedInputs: true,
    description: 'Moteur historique de Clair. Calcul et vérification sur votre appareil.',
    experimental: false,
  }),
  Object.freeze({
    id: PLONK_ENGINE,
    name: 'Circom / PLONK',
    description:
      'Alternative utilisant des paramètres publics universels. La première préparation peut prendre plus de temps.',
    experimental: false,
  }),
  Object.freeze({
    id: FFLONK_ENGINE,
    name: 'Circom / FFLONK',
    description:
      'Moteur expérimental pour les circuits légers. Réduisez la complexité si la préparation atteint sa limite.',
    experimental: true,
  }),
]);
export function assertEngineCapabilities(circuit, engine = circuit.engine ?? ENGINE) {
  if (circuit.vat && engine !== ENGINE) throw Error('Le circuit TVA nécessite Noir / UltraHonk.');
  if (
    circuit.inputs.some((i) => i.source === 'signed' && i.visibility === 'private') &&
    engine !== ENGINE
  )
    throw Error('Les entrées signées privées nécessitent Noir / UltraHonk.');
}
export const engineName = (id = ENGINE) =>
  ZK_ENGINES.find((engine) => engine.id === id)?.name ?? 'Moteur inconnu';
