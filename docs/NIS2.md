# Préparation NIS2

État au 02/11/2026 : PoC local, hébergement à définir. **Aucune conformité ou certification NIS2 n’est déclarée.**

NIS2 vise les obligations de l’entité concernée, avec des mesures techniques et organisationnelles. Cet audit contribue au volet logiciel ; il ne délivre pas une certification du SaaS. Selon la page ANSSI consultée à cette date, la transposition française est en cours et ReCyF est une version de travail susceptible d’évolution. Le cadre applicable doit donc être revalidé avant déploiement. [ANSSI](https://messervices.cyber.gouv.fr/nis2)

L’assujettissement de l’exploitant, sa catégorie et le référentiel applicable ne peuvent pas être déterminés à partir du dépôt. Examiner l’activité réelle, la taille, les exceptions et les éventuelles règles sectorielles. Pour certaines catégories de fournisseurs numériques, l’ANSSI renvoie à des exigences européennes spécifiques. Le fait de vérifier des signatures dans Clair ne démontre pas le statut juridique de prestataire de services de confiance.

## Inventaire initial à compléter

| Actif                 | Données et dépendances                                                   | Mesures présentes                                            | Responsable / preuve manquante                                           |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Application et dépôt  | Code, configuration, verrou npm, workflows                               | Tests, revue, audit npm, versions ZK verrouillées            | Propriétaire du service, protection des branches, revue des accès GitHub |
| Serveur HTTP          | Circuits et enveloppes publics, sessions, droits                         | Origine, authentification, limites, compilateurs isolés      | Hébergeur, réseau, supervision et limites OS                             |
| SQLite et sauvegardes | E-mails, hashes de mots de passe, sessions, archives                     | SQL paramétré, isolation des propriétaires                   | Gestionnaire de sauvegarde, chiffrement, restauration prouvée            |
| Navigateur            | Valeurs privées, UBL, attestations et clés privées pendant le parcours   | Calcul local, nettoyage des formulaires, CSP                 | Politique des postes et sensibilisation des utilisateurs                 |
| Registre d’autorités  | Clés publiques, approbations, révocations                                | Administration par identifiant et événements de modification | MFA, procédure d’approbation, rotation et réponse à compromission        |
| Stripe                | Identifiants clients, abonnements et moyens de paiement gérés par Stripe | Webhooks signés et relecture serveur                         | Revue des accès Stripe, MFA du compte, contrat et suivi fournisseur      |
| Vérificateur portable | Code, runtime, paramètres et instantané public                           | Vérification locale, politique Node et ressources bornées    | Signature de distribution, renouvellement et information sur révocations |

Compléter également les dépendances des postes administrateur, DNS, certificats TLS, messagerie, outils de sauvegarde et sous-traitants. Aucun de ces éléments n’a été inventorié sur une infrastructure réelle.

## Correspondance de préparation

Cette matrice s’appuie sur les thèmes des articles 20, 21 et 23 de la directive. Elle ne prétend pas couvrir toutes les mesures ReCyF ni attribuer un niveau de conformité.

| Thème                                    | Éléments disponibles dans le projet                                             | Reste à démontrer                                                                               | Priorité                  |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| Gouvernance et risques                   | Rapport technique, frontières de confiance                                      | Responsable désigné, analyse de risques et PSSI approuvées, budget et revue périodique          | Avant exposition          |
| Incidents                                | Événements de sécurité expurgés                                                 | Collecte, alertes, contacts, procédure et exercice ; obligations de signalement applicables     | Avant exposition          |
| Continuité                               | SQLite persistant                                                               | Sauvegarde séparée/chiffrée, RPO/RTO, restauration et gestion de crise                          | Avant exposition          |
| Fournisseurs                             | Dépendances identifiées, verrou npm, Stripe et paramètres publics documentés    | Registre des fournisseurs, clauses, évaluation et suivi des changements                         | Avant exposition          |
| Développement sécurisé                   | Correctifs, tests d’abus, CI préparée, dépendances corrigées                    | CI exécutée, revue à deux personnes, traitement des alertes, pentest du déploiement             | Avant exposition          |
| Efficacité des mesures                   | Tests automatisés et revue interne                                              | Mesures régulières, revue indépendante et suivi des écarts                                      | Avant production sensible |
| Hygiène et formation                     | Documentation d’utilisation et de sécurité                                      | Formation des exploitants, utilisateurs et personnes habilitées                                 | Avant exploitation        |
| Cryptographie et clés                    | Signatures P-256, séparation public/privé, versions ZK verrouillées             | Politique de gestion des clés, rotation, récupération, compromission, revue ZK indépendante     | Avant données réelles     |
| Comptes et accès                         | Sessions révocables, administration par identifiant, limites d’authentification | MFA, revue des habilitations, cycle de vie, récupération et départs                             | Avant exposition          |
| Authentification forte et communications | HTTPS exigé en production                                                       | MFA approprié et canaux de secours administratifs, contrôle des comptes hébergeur/GitHub/Stripe | Avant exposition          |

## Décision d’ouverture

Le responsable du service devra compléter et approuver les points suivants :

1. Confirmer le périmètre réglementaire et la juridiction, avec les ressources de l’ANSSI et un accompagnement compétent si nécessaire.
2. Installer une LTS Node corrigée et choisir l’hébergement ; documenter architecture, flux, responsabilités et accès.
3. Déployer MFA, récupération de compte, gestion des secrets et politique des autorités signataires.
4. Configurer les sauvegardes et réussir une restauration isolée ; fixer les objectifs de reprise et les délais acceptables de perte de données.
5. Centraliser les logs, définir les alertes et exercer la gestion d’incident.
6. Exécuter la CI et le pentest sur le déploiement final, puis traiter les écarts.
7. Conserver les preuves : versions, résultats datés, approbations, exercices, correctifs et acceptations de risques.

Les engagements organisationnels appartiennent à l’exploitant : aucun responsable, contrat, délai de traitement, RPO ou RTO n’est présenté ici comme déjà approuvé. Voir le [rapport technique](AUDIT-SECURITE-2026-11-02.md) et le [canevas incident](INCIDENTS.md).
