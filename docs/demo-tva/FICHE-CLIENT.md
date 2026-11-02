# Clair — prouver un montant de TVA sans partager chaque facture

**Prototype de démonstration · 02/11/2026**

Une entreprise souhaite justifier la TVA collectée sur une période. Clair permet de transmettre une preuve vérifiable du calcul, accompagnée de la provenance du relevé, plutôt que le détail de toutes les factures.

## Le parcours

**Logiciel de facturation → relevé complet signé → calcul local → preuve partagée → vérification.**

1. Une source de confiance approuvée fournit les XML UBL et signe un relevé de l’entreprise pour une période clôturée.
2. L’entreprise calcule la preuve sur son appareil. Les ventes et les avoirs du relevé sont pris en compte.
3. Le destinataire vérifie le fichier de preuve, le circuit attendu, le résultat et la source. Il peut demander les originaux pour un contrôle complémentaire.

| Le destinataire voit                            | Les éléments qui restent privés                      |
| ----------------------------------------------- | ---------------------------------------------------- |
| Entreprise, période, nombre de pièces           | XML originaux et numéros de facture                  |
| TVA des ventes, TVA des avoirs et solde         | Clients, articles et montants par facture            |
| Source signataire, validité du relevé           | Clé privée de signature et masque de confidentialité |
| Règle de calcul et engagements cryptographiques | Détail des données utilisées pour le calcul          |

Les totaux publics peuvent permettre des déductions sur de petits lots. Le choix des informations à rendre publiques doit être validé avec le destinataire.

## Ce que démontre le PoC

Import et validation des profils UBL pris en charge, contrôle des dates, intégrité du lot certifié, règles de calcul et d’arrondi définies par le circuit, total des ventes diminué des avoirs, puis vérification sans compte. Le format accepte jusqu’à **500 pièces par lot** ; les performances mesurées sur le poste de démonstration figurent dans [MESURES-2026-11-02.md](MESURES-2026-11-02.md).

## La responsabilité du signataire

La source atteste l’exhaustivité du relevé et la qualification des données. La preuve vérifie la cohérence avec ce relevé signé ; elle ne peut pas découvrir une facture que la source aurait omise avant la signature. L’autorité atteste aussi la correspondance des données normalisées avec les XML : le circuit n’analyse pas lui-même le XML.

## Limites actuelles

PoC local, documents et autorité de démonstration fictifs, euros et périmètre ventes/avoirs rattachés à la date des pièces. Les cas de TVA non couverts sont refusés ou à cadrer avant un pilote. Ce n’est pas une déclaration fiscale complète, un connecteur de plateforme en production, une certification de conformité ou une validation par l’administration. Les preuves n’établissent pas l’identité du porteur.

**Objectif du premier pilote :** confirmer avec un logiciel de facturation et un destinataire que la preuve répond à un contrôle précis, avec des résultats identiques au calcul métier de référence et une réduction mesurée des informations partagées.
