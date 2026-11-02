# Pilote TVA — proposition à valider avec le client

**Version du 02/11/2026 · cadrage proposé, pas engagement de livraison**

## Le périmètre du premier pilote

Une entreprise, une période clôturée et une source de facturation. Des ventes et avoirs en EUR, dans le sous-ensemble UBL accepté par Clair. Commencer par 10 pièces, puis élargir à 100 et 500 si les données métier et le poste le permettent. Commencer avec des données fictives ou anonymisées.

Le montant prouvé est la TVA facturée sur les ventes diminuée de celle des avoirs, selon la date des pièces et les règles d’arrondi du PoC. Le métier doit confirmer que ce périmètre répond au contrôle visé ; le pilote ne couvre pas automatiquement l’exigibilité à l’encaissement, la TVA déductible ou une déclaration complète.

## Participants et responsabilités

| Participant                        | À fournir ou décider                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| Entreprise pilote                  | Un responsable métier, une période et un calcul de référence validé                             |
| Logiciel de facturation / émetteur | Export UBL, inventaire complet, procédure de clôture et clé de signature gérée par l’émetteur   |
| Destinataire de la preuve          | La question à vérifier, les paramètres publics attendus et les sources de confiance acceptables |
| Équipe Clair                       | Import, format de relevé, circuit, preuves, mesures, restitution des limites et des erreurs     |

## Les données nécessaires

- Export des factures de vente et avoirs de la période, avec leurs identifiants, dates, fournisseur, références et décompositions de TVA.
- Inventaire de référence de la plateforme : nombre de pièces, identifiants, périmètre, annulations, documents remplacés et mode de clôture. Cet inventaire doit être indépendant de la seule sélection manuelle de fichiers.
- Totaux de TVA des ventes et des avoirs calculés par le logiciel métier, avec la règle d’arrondi documentée.
- Identifiant d’entreprise stable, période et devise. Définir précisément quelles données deviennent publiques.
- Clé publique P-256 de l’émetteur, identité de la source, politique d’approbation, durée du relevé et procédure de révocation. La clé privée reste chez l’émetteur.
- Configuration du poste cible et du navigateur ; connexions nécessaires au chargement des paramètres publics.

## Quel logiciel raccorder ?

À choisir lors du cadrage, sans promettre un connecteur universel. Vérifier sur un échantillon réel :

1. Profils et versions UBL exportés, documents corrigés, avoirs et cas sans TVA.
2. Possibilité d’obtenir un export complet et clôturé de l’entreprise et de la période.
3. Point d’intégration disponible : export de fichiers d’abord ; API du logiciel ensuite si elle apporte une automatisation utile.
4. Capacité de l’émetteur à signer le relevé Clair et à protéger sa clé. Une facture XML valide ne remplace pas cette attestation.
5. Traitement des divergences d’arrondi et des cas refusés, avant toute production de preuve.

## Étapes et livrables

| Étape                         | Livrable                                                                                 | Condition de passage                               |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Cadrage métier                | Périmètre, destinataire, jeu de référence, données publiques et exigences de performance | Accord des participants                            |
| Qualification de l’export     | Rapport des XML acceptés/refusés et des cas non couverts                                 | Aucun fichier problématique ignoré silencieusement |
| Certification de la période   | Relevé complet signé et procédure d’émission documentée                                  | Origine, clôture et approbation de source établies |
| Démonstration de bout en bout | Preuve et vérification indépendante par le destinataire                                  | Totaux identiques au référentiel                   |
| Évaluation                    | Mesures, erreurs testées, risques résiduels et décision                                  | Validation ou liste d’écarts explicite             |

Les dates, responsables et objectifs chiffrés de performance seront fixés après découverte du logiciel et du poste cible. Aucune promesse de délai ou de débit n’est déduite du seul benchmark local.

## Critères de réussite

- **Exactitude :** écart de 0 centime sur les totaux du périmètre accepté, ou divergence explicitement classée et résolue avant de valider le pilote.
- **Intégrité :** une omission ou modification après certification est détectée ; une preuve altérée et une signature invalide sont rejetées.
- **Exhaustivité :** concordance de l’inventaire indépendant de la plateforme et du relevé signé. Le signataire assume les omissions éventuelles avant certification.
- **Confiance :** seule une source approuvée est acceptée ; révocation et expiration sont testées. La preuve mathématique peut rester correcte malgré une provenance devenue non approuvée.
- **Confidentialité :** aucun XML, numéro de facture, détail de ligne, masque ou clé privée n’est envoyé aux API Clair ; seuls les éléments publics convenus sont partagés.
- **Vérification indépendante :** le destinataire contrôle la preuve sans le compte de l’entreprise et compare le circuit et les paramètres à sa demande.
- **Performance et ergonomie :** mesures sur le poste cible pour 10, 100 et 500 pièces, taux d’échec documenté, objectif d’attente accepté par le client. Un refus ou un dépassement doit être expliqué.
- **Réversibilité :** l’entreprise conserve les originaux et son lot privé ; elle sait reproduire l’export et remettre les factures lors d’un contrôle.

## Décision de fin de pilote

Poursuivre uniquement si le besoin métier, l’export complet, la chaîne de confiance et les performances sont validés. Définir alors le connecteur, l’API ou le SDK utile, l’hébergement, les responsabilités, l’audit cryptographique et les exigences d’exploitation. L’acceptation d’une preuve par une administration reste à convenir avec cette administration.
