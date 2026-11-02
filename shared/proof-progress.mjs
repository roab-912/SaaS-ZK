export const PROOF_STEPS = Object.freeze(
  [
    { id: 'prepare', label: 'Préparation du circuit' },
    { id: 'validate', label: 'Contrôle des données' },
    { id: 'witness', label: 'Calcul des contraintes' },
    { id: 'prove', label: 'Création de la preuve' },
    { id: 'verify', label: 'Vérification locale' },
    { id: 'finish', label: 'Finalisation' },
  ].map(Object.freeze),
);
export function isProofStage(stage) {
  return PROOF_STEPS.some((step) => step.id === stage);
}
