# Audit de sécurité — Clair

Date de clôture : 02/11/2026. Revue commencée le 30/10/2026.

## Périmètre et résultat

Revue du dépôt, des dépendances npm, des contrôles HTTP, des comptes et sessions, des opérations administrateur, du paiement, des compilateurs et du vérificateur portable. L’utilisateur a confirmé un **PoC local uniquement, sans hébergement de production choisi**.

Les vérifications actives utilisent des comptes fictifs, des bases SQLite en mémoire, des ports distincts et des marqueurs synthétiques. Aucune charge malveillante n’a été envoyée au serveur personnel, aucun secret réel n’a été affiché et aucune clé Stripe n’a été renouvelée. Les essais de paiement de cet audit utilisent un client simulé ; les transactions Stripe externes n’ont pas été rejouées.

Ce document est une revue technique interne avec correctifs et tests. Il ne constitue ni une certification NIS2, ni un pentest indépendant d’une infrastructure déployée, ni un audit mathématique des moteurs ZK.

## Constats et corrections

Les niveaux ci-dessous sont des priorités de traitement pour ce projet ; ils ne sont pas des scores CVSS recalculés.

| Référence | Priorité                         | Constat et preuve                                                                                                                                                                                              | Correction                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01       | Haute                            | Le serveur Vite répondait 200 pour un marqueur dans data/ et pour server/config.mjs. Un déploiement de ce serveur pouvait exposer la base ou des exports. Le test n’a pas téléchargé de vraie base ni de .env. | Liste d’accès limitée au code navigateur et aux dépendances ; refus des fichiers internes, SQLite et .clair. Même avec Stripe, le mode développement/prévisualisation exige une origine et une écoute locales. Les mêmes requêtes, y compris ?raw et /@fs/, sont bloquées.                                                                                                                  |
| A02       | Haute pour certaines dépendances | Le relevé initial signalait 17 paquets, dont 5 de sévérité élevée. Il s’agit d’alertes sur des versions installées, pas de 17 exploitations démontrées de Clair.                                               | Correctifs Express/body-parser, Vite, Vitest, Zod 4 et dépendances transitives. Suppression de la chaîne elliptic/crypto-browserify inutilisée. La nouvelle alerte minimatch apparue pendant la revue est corrigée par un override minimatch 11.0.1 et filelist 2.0.2 pour conserver les chemins Windows, avec contrôle ESLint et filelist. Les versions des moteurs ZK restent inchangées. |
| A03       | Haute pour la disponibilité      | La compilation Noir était exécutée dans le processus HTTP, sans interruption possible par ce service. Une compilation coûteuse pouvait bloquer les autres utilisateurs.                                        | Sous-processus sans héritage des secrets, délai de 180 s, plafond de tas V8 de 512 Mio, sortie bornée et nettoyage des fichiers temporaires vérifié. La file et le cache existants restent bornés.                                                                                                                                                                                          |
| A04       | Moyenne                          | Les dérivations scrypt asynchrones n’avaient pas de limite globale de concurrence ; la limitation par IP seule ne borne pas une attaque distribuée.                                                            | Deux dérivations simultanées maximum par processus ; excédent refusé en 429, sans file illimitée. Dix échecs de connexion par compte normalisé sur quinze minutes, en complément de la limite par IP.                                                                                                                                                                                       |
| A05       | Moyenne                          | La déconnexion d’un appareil ne permettait pas de révoquer les autres sessions d’un compte compromis.                                                                                                          | POST /api/auth/logout-all authentifié et protégé par l’origine. Bouton dans Mon abonnement. Les sessions d’un autre utilisateur restent valides. En HTTPS, cookie __Host-clair_session, Secure, HttpOnly, sans Domain.                                                                                                                                                                      |
| A06       | Moyenne                          | Les actions sensibles ne disposaient pas d’un journal applicatif de sécurité.                                                                                                                                  | Événements de connexion, échec, inscription, déconnexion/révocation, modification du registre et opérations de facturation. Liste stricte des champs : identifiants, empreinte publique, offre et horodatage ; aucun mot de passe, e-mail, témoin, clé privée ou secret de paiement.                                                                                                        |
| A07       | Haute avant production           | La machine utilise Node 25.4.0, branche désormais en fin de vie. Le constructeur portable copiait ce runtime.                                                                                                  | Politique de branches LTS corrigées ; refus au démarrage de production, à la construction et à la mise à disposition d’une archive hors ligne obsolète. .node-version recommande 24.22.2. L’installation système n’est pas modifiée : sa mise à jour reste à effectuer.                                                                                                                     |
| A08       | Moyenne                          | La décompression des requêtes était active avant le traitement métier, y compris sur le webhook. Une alerte body-parser concerne ce chemin.                                                                    | Dépendance corrigée et inflate:false sur JSON et le corps brut Stripe. gzip/deflate/br sont refusés en 415 avant décompression. Délais HTTP et nombre de requêtes par socket bornés.                                                                                                                                                                                                        |

Le plafond V8 ne limite pas toute la mémoire native/WASM. La production devra aussi imposer des limites de mémoire, CPU et processus au niveau de l’hébergement. La journalisation ajoutée ne constitue pas une supervision centralisée, un stockage inviolable ou un historique exhaustif de toutes les actions.

## Contrôles conservés et réexaminés

- Sessions stockées sous forme d’empreinte, rotation à la connexion, expiration et contrôle d’accès serveur.
- Filtrage de propriétaire des circuits/preuves, SQL paramétré et quotas transactionnels.
- Autorisation des administrateurs par identifiant, validation des clés publiques et refus des clés privées dans le registre.
- Origine exacte pour les mutations ; webhooks Stripe signés sur les octets bruts, puis relecture du statut Stripe.
- CSP distinctes pour paiement et ZK, sans chargement de Stripe dans le document de calcul privé.
- Bornes de circuits et de fichiers ; DTD, entités externes et XML trop complexes refusés.
- Vérification des paramètres publics, du circuit attendu, des signatures et de la révocation ; les preuves peuvent valablement annoncer un résultat faux.
- Les témoins privés, factures UBL et clés de signature restent locaux. Une signature certifie une déclaration de l’émetteur ; elle ne garantit pas l’identité du porteur ni la véracité de la comptabilité.

Aucune injection SQL, exécution de programme arbitraire par un circuit, XXE ou élévation d’un compte standard vers l’administration n’a été démontrée dans les parcours examinés. Cette observation ne garantit pas leur absence dans toutes les configurations ou dépendances.

Le contrôle des fichiers suivis et des motifs de fichiers sensibles dans les 14 commits du dépôt n’a trouvé aucun candidat de secret avec les règles examinées. Ce contrôle ciblé ne remplace pas un scanner de secrets complet ni une revue de tous les historiques distants.

## Vérification reproductible

Utiliser la version Node de .node-version pour la production et le logiciel portable.

```powershell
npm ci --ignore-scripts
npm run audit:dependencies
npm run test:security
npm run lint
npm test
npm run build
npx playwright test tests/security.spec.mjs tests/billing.spec.mjs tests/saas.spec.mjs tests/catalog.spec.mjs tests/app.spec.mjs
```

La suite navigateur conserve les limites de fréquence de production et attend leur réinitialisation entre parcours. Le test security.spec utilise un fichier temporaire synthétique et vérifie son inaccessibilité. Les tests de compilateur comparent les bytecodes déterministes et vérifient l’absence de secrets dans l’environnement du sous-processus. Les tests cryptographiques existants couvrent aussi les trois moteurs, les signatures privées et la TVA sur 500 factures.

Le workflow .github/workflows/security.yml prépare ces contrôles sur GitHub avec un jeton en lecture seule et des actions officielles épinglées par commit. Il doit être poussé et exécuté pour fournir une preuve de CI ; sa présence locale n’est pas une exécution réussie. Dependabot prépare les mises à jour, sans fusion automatique des changements cryptographiques.

Les ressources vendoriées (notamment SaxonJS, schémas UBL et fichiers WASM) ne sont pas toutes couvertes par npm audit. Une absence d’alerte npm ne prouve pas l’absence de faille dans ces composants.

## Résultats de clôture

Contrôles locaux terminés le 02/11/2026 :

- npm audit : **0 vulnérabilité connue signalée**, après prise en compte de la nouvelle alerte minimatch.
- Suite complète sous Node 24.22.2 LTS : **122 fichiers et 290 tests réussis**.
- Navigateur : **10 parcours réussis en développement**, puis **10 sur la version compilée**, couvrant les trois moteurs, les comptes, la facturation et les protections de fichiers/sessions.
- Validation UBL sur la version compilée : **1 parcours supplémentaire réussi**, avec refus des montants invalides et contrôle de l’affichage mobile.
- Distribution Windows reconstruite avec Node 24.22.2 : **1 test complet réussi**, avec trois moteurs, signature privée et 500 factures, en utilisant le Node embarqué et le blocage réseau des moteurs.
- Compilation, lint, formatage et contrôle des espaces du diff : réussis. Rollup signale des annotations de commentaires Zod supprimées lors de la compilation ; la compilation aboutit.
- Inventaire CycloneDX généré dans data/security-audit/sbom.cdx.json : **463 composants du verrou npm**, incluant des dépendances optionnelles. Ce fichier local ignoré n’est pas un inventaire complet de l’infrastructure ou des ressources vendoriées.

La CI GitHub n’a pas été exécutée depuis cette session ; aucun hébergement de production n’a été testé. L’installation système de Node reste inchangée. Un exécutable officiel LTS, dont le SHA-256 a été comparé au manifeste Node.js, a été utilisé uniquement pour les validations et la construction locale.

## Risques restant ouverts

| Référence | État avant ouverture publique   | Travail attendu                                                                                                                                                                                                                    |
| --------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01       | Bloquant                        | Remplacer Node 25 sur les postes d’exploitation par une LTS corrigée ; maintenir les seuils de runtime et reconstruire les distributions à chaque mise à jour.                                                                     |
| R02       | Bloquant pour une cible NIS2    | Ajouter une authentification multifacteur adaptée, au minimum pour les administrateurs et l’exploitation ; définir récupération et révocation. Aucun MFA n’a été ajouté par cet audit.                                             |
| R03       | À réaliser sur l’hébergement    | TLS réel, compte système dédié, droits minimaux sur SQLite/secrets, limites OS, proxy, filtrage réseau et protection contre les dénis de service. L’hébergement n’est pas défini.                                                  |
| R04       | À réaliser et démontrer         | Sauvegardes chiffrées séparées, objectifs de reprise et exercice de restauration. Un fichier SQLite et son journal WAL ne doivent pas être copiés arbitrairement pendant une écriture.                                             |
| R05       | À organiser                     | Collecte centralisée des événements, rétention, contrôle d’accès et alertes ; les logs locaux peuvent être supprimés par un administrateur de la machine.                                                                          |
| R06       | À organiser                     | Gouvernance, analyse de risques approuvée, suivi des fournisseurs, gestion des incidents, formation et preuves d’application. Voir NIS2.md.                                                                                        |
| R07       | À prévoir                       | Pentest de l’application déployée et revue indépendante des circuits, compilateurs et garanties ZK. La revue de ce dépôt ne remplace pas ces examens.                                                                              |
| R08       | Avant ouverture commerciale     | Vérification des e-mails et récupération de compte sécurisée. L’inscription permet encore de distinguer une adresse déjà enregistrée ; l’adresse déclarée ne prouve pas une identité.                                              |
| R09       | Selon le modèle de distribution | Authenticité indépendante du logiciel portable et des instantanés : prévoir signature de code/distribution, politique de mise à jour et durée d’utilisation. Les révocations postérieures à l’export restent inconnues hors ligne. |

La limitation par compte peut temporairement gêner un utilisateur ciblé par des tentatives hostiles ; elle ne remplace pas le MFA, la détection et la protection réseau. Les limites et verrous restent propres à une instance : une architecture multi-instance exigera un stockage partagé.

## Références

- [ANSSI — démarche NIS2 et ReCyF](https://messervices.cyber.gouv.fr/nis2), consulté le 02/11/2026.
- [Directive (UE) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj).
- [Node.js — versions maintenues](https://nodejs.org/en/about/previous-releases) et [calendrier officiel](https://github.com/nodejs/Release/blob/main/schedule.json).
- [Alerte body-parser](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828).
- [Alerte minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).
