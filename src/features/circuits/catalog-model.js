import { template, validateCircuit } from '../../../shared/circuit.mjs';
import { ENGINE } from '../../../shared/engines.mjs';
export const CIRCUIT_CATALOG = [
  {
    id: 'age',
    title: 'Condition de majorité',
    description: 'Prouvez que vous avez au moins 18 ans, sans révéler votre date de naissance.',
    category: 'Identité · Dates',
    color: 'sage',
    fields: 'Votre date de naissance · Date limite publique',
  },
  {
    id: 'revenue',
    title: 'Revenu supérieur à un seuil',
    description: 'Prouvez que vos revenus dépassent un montant, sans dévoiler ce que vous gagnez.',
    category: 'Finance · Comparaison',
    color: 'sand',
    fields: 'Vos revenus mensuels · Seuil public au choix',
  },
  {
    id: 'income',
    title: 'Capacité financière',
    description: 'Prouvez que vos revenus couvrent au moins trois fois le loyer.',
    category: 'Finance · Calculs',
    color: 'sand',
    fields: 'Vos revenus mensuels · Loyer public',
  },
  {
    id: 'list',
    title: 'Zone éligible',
    description:
      'Prouvez que votre département appartient à la liste des départements franciliens.',
    category: 'Éligibilité · Listes',
    color: 'lavender',
    fields: 'Votre département · Liste publique des 8 départements',
  },
];
export function readyCircuit(id, engine = ENGINE) {
  if (!CIRCUIT_CATALOG.some((item) => item.id === id)) throw Error('Modèle inconnu.');
  const circuit = template(id === 'revenue' ? 'income' : id);
  if (id === 'revenue') {
    circuit.name = 'Revenu supérieur à un seuil';
    circuit.description =
      'Démontrer que ses revenus mensuels dépassent strictement le seuil public. Les montants sont des euros entiers, pour une même période mensuelle.';
    circuit.inputs[1] = {
      id: 'threshold',
      label: 'Seuil mensuel en euros',
      type: 'number',
      visibility: 'public',
      source: 'declared',
    };
    circuit.root = {
      kind: 'op',
      op: 'gt',
      args: [
        { kind: 'input', id: 'income' },
        { kind: 'input', id: 'threshold' },
      ],
    };
  }
  if (id === 'income')
    circuit.description +=
      ' Les deux montants sont des euros entiers, pour une même période mensuelle.';
  return validateCircuit({ ...circuit, version: 2, engine });
}
// Only public examples are prefilled. Private values always start empty.
export function publicDefaults(id) {
  if (id === 'revenue') return { threshold: '2000' };
  if (id === 'income') return { rent: '800' };
  return {};
}
