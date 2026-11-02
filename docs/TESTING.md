# Tests et qualité

## Exécuter les contrôles

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:built
```

Vitest exécute les tests unitaires et d’intégration. Les modules React utilisent jsdom et Testing Library ; les parcours réels utilisent Chromium via Playwright.

Chaque fichier exécutable de src/, server/, shared/ et zk/ possède un fichier dédié au même emplacement sous tests/ avec le suffixe .test. Le test d’architecture échoue si un nouveau module n’a pas son fichier de test. Les configurations d’outillage ont leurs tests dans tests/config/.

La présence d’un fichier n’est pas suffisante : les tests vérifient des comportements, erreurs, autorisations, formats et cycles de vie. Le rapport HTML généré par npm run test:coverage est disponible dans coverage/index.html. Les seuils globaux imposés sont 75 % des instructions/lignes/fonctions et 65 % des branches ; ils servent de plancher, pas de preuve de sécurité.

## Répartition

- Domaine : types, bornes, dates, empreintes stables, encodages et enveloppes malformées.
- ZK : trois moteurs réels (Noir / UltraHonk, Circom / PLONK, Circom / FFLONK), un adaptateur simulé pour le contrat, sélection explicite, liaison moteur/circuit, option ZK obligatoire, nettoyage du témoin, compilation réelle et preuves falsifiées.
- Serveur : mots de passe historiques, rotation/expiration, isolation des comptes, CSRF, clés publiques valides, erreurs expurgées, concurrence et saturation.
- Stripe : vraies signatures de webhook SDK avec un client Stripe simulé, abonnement autoritatif, annulation, pages de résultats et sessions réutilisées. Aucun paiement externe n’est exécuté.
- Interface : actions des composants, erreurs de saisie, accès à l’abonnement, téléchargement, archivage, vérification et conservation locale des entrées privées.
- Bout en bout : inscription, abonnement, circuit, preuve WASM locale, téléchargement, archivage, vérification sans compte, falsification et expiration.

Les imports et exports de circuits, preuves, attestations et clés privées utilisent exclusivement l’extension `.clair`. Les tests contrôlent les filtres des sélecteurs et les noms réellement téléchargés, tout en conservant la validation du contenu JSON.

Les tests utilisent une base en mémoire et un port distinct ; ils ne réemploient pas le serveur ou la base personnels. Le test de migration SQLite crée seulement un dossier temporaire propre au test.

Les tests Circom réutilisent les paramètres publics du cache `data/zk-parameters/`. À défaut, le premier lancement télécharge environ 76 Mo depuis PSE et en contrôle l’empreinte. Les tests des contraintes contournent la validation de l’interface pour soumettre directement des témoins invalides au WASM. Les tests cryptographiques vérifient aussi les falsifications et la reproductibilité des clés après recompilation. Le parcours navigateur complet s’exécute pour chacun des trois moteurs.

## Non-régression visuelle

tests/visual/dashboard-desktop.png et dashboard-mobile.png sont les captures conservées avant le refactoring. Les tests les comparent avec une tolérance de zéro pixel différent, sans régénérer la référence. Ils couvrent les vues 1440 × 1050 et 390 × 844.

Ces captures ont été prises sous Windows/Chromium ; un autre système ou un changement de moteur de rendu peut produire des différences de police. Examiner toute différence avant une mise à jour volontaire des références. Ne pas remplacer les captures uniquement pour faire réussir un test.

## Ajouter une fonctionnalité

Ajouter son test au même chemin, vérifier le cas valide et les principales erreurs, puis lancer la suite concernée. Pour un moteur ZK, conserver une vraie preuve positive et des tests négatifs sur preuve, contexte et paramètres publics. Pour une route, tester aussi un autre compte et un compte sans abonnement.

Les tests d’architecture empêchent l’import de SDK ZK dans les écrans/domaine et la dispersion du SQL hors de la persistance.

## Signatures privées Noir

Les tests exécutent une vraie preuve UltraHonk avec signature P-256 cachée, puis sa vérification, la révocation et la falsification des dates. Les tests soumettent directement au programme Noir des témoins dont la valeur, la signature, l’UUID ou la validité ont été modifiés pour éviter de tester uniquement les gardes de l’interface. Les encodages nombre, date et booléen sont exécutés dans Noir. Les enveloppes mixtes publiques/privées sont contrôlées pour éviter toute fuite de signature ou valeur privée.

Le parcours navigateur supplémentaire configure une entrée signée privée, émet et importe son attestation, génère et archive la preuve, puis vérifie sa provenance sans compte. Il contrôle l’absence de valeur et signature privées dans les requêtes API et dans l’export, ainsi que le refus des moteurs incompatibles.

## Distribution hors ligne

Les tests de offline/ couvrent le registre public, les contrôles d’intégrité, les accès locaux, les erreurs expurgées et l’interface de vérification. La suite séparée `npm run test:offline` construit et télécharge le vrai logiciel, l’extrait hors du dépôt et utilise son Node embarqué pour vérifier les trois moteurs, une signature privée et une falsification. Voir [OFFLINE.md](OFFLINE.md).

## Abonnements et administration

Les tests contrôlent les plafonds de stockage, les réservations simultanées, l’expiration et la confirmation idempotente des générations, le changement de mois, l’isolation des comptes et les changements d’offre. Le tableau de bord administrateur exige un identifiant autorisé et n’expose que des agrégats. Le contrat Stripe couvre le choix du tarif, l’expiration d’une session Checkout d’une autre offre et la réconciliation des droits après changement de tarif. Les transactions externes et les portefeuilles Apple Pay/Google Pay doivent être vérifiés avec votre compte Stripe ; les tests automatisés utilisent un client simulé.

Configuration : [BILLING.md](BILLING.md).

Les tests Stripe couvrent les 30 jours sur les deux offres, le moyen de paiement obligatoire, la non-réutilisation après annulation et les tarifs chargés depuis Stripe. Les parcours ZK navigateur utilisent un serveur de fixture sous tests/helpers/browser-server.mjs, limité au port 3001 avec base en mémoire ; ses routes de préparation ne sont jamais importées par le serveur normal. Aucun endpoint de démonstration ne peut activer un compte dans le SaaS. Les transactions externes doivent ensuite être testées avec les valeurs du .env.

## TVA certifiée

Les tests tests/shared/vat.test.mjs et tests/zk/noir/vat-*.test.mjs vérifient les règles et les contraintes réelles. tests/vat-crypto.test.mjs ajoute un calcul UltraHonk sur 500 pièces et peut prendre plusieurs minutes selon la machine. tests/vat.spec.mjs réalise le parcours UBL complet avec archivage et quotas dans un navigateur, vérifie l’absence de détails privés dans les requêtes et rejette une source révoquée. Ces tests utilisent des clés, factures et comptes de démonstration isolés. Voir [TVA.md](TVA.md).

## UBL

Les tests de shared/ubl, shared/vat-documents et src/lib/ubl-validation contrôlent les espaces de noms, montants, références, profils, erreurs XSD et règles Schematron officielles. tests/ubl.spec.mjs exerce la validation, la certification, les originaux privés et la preuve TVA dans le navigateur, puis la vérification anonyme et la révocation. Le parcours principal utilise 500 documents. Le parcours court télécharge les exemples ZIP depuis l’interface, extrait leurs XML et les réimporte, puis vérifie les erreurs visibles et l’affichage mobile. Il s’exécute avec Vite et avec la version compilée pour couvrir les réponses HTTP gzip déjà décompressées par le navigateur. Les tests refusent aussi les anciens lots sans originaux UBL. Le test de distribution portable vérifie un relevé UBL version 2 sur 500 documents sans réseau. La génération des ressources est contrôlée par les empreintes des sources dans tests/scripts/build-ubl-assets.test.mjs.

Les exemples UBL anonymisés de tests/fixtures/ubl couvrent une vente avec acompte, une autoliquidation AE et un export G avec fournisseur étranger. Les règles officielles sont exécutées sur ces documents, puis sur des variantes non conformes : Note mal ordonnée, code VATEX invalide, mauvais schéma d’adresse et catégorie contradictoire. Le parcours navigateur prouve aussi leur total de TVA sans exposer les détails. Aucune correction automatique n’est appliquée à l’import.

## Parcours accessibles aux non spécialistes

Les tests de JourneySteps vérifient l’étape courante accessible. Le parcours TVA teste la transmission locale du lot signé vers la preuve sans téléchargement intermédiaire, et l’import d’un lot reçu. Le scénario navigateur étranger vérifie cette continuité sur mobile, l’absence de factures et de clé privée dans les requêtes et les quotas. Les tests génériques vérifient toujours les trois moteurs, les résultats faux et les signatures privées, avec les réglages techniques repliés.

## Formulaire Stripe intégré

Les fichiers billing-checkout.test.mjs et billing-management.test.mjs couvrent les sessions propres au compte, l’essai unique, les cartes, les récapitulatifs expirés ou modifiés, les paiements en attente, l’idempotence et le renouvellement. Chaque composant de paiement possède son fichier de test avec SDK simulé. Les tests security.test.mjs vérifient les CSP et l’isolation distinctes des documents ZK et de paiement. tests/billing.spec.mjs vérifie les navigations et le retour à un espace ZK isolé, avec un compte et une base de test.

Ces suites automatisées ordinaires ne débitent pas Stripe. Pour tester le formulaire réel, utiliser les clés de test du même compte et un compte Clair de test. Vérifier la carte 4242, le refus de carte, l’authentification bancaire, le changement d’offre qui termine l’essai, la mise à jour de carte, puis le renouvellement et les droits. Les portefeuilles demandent un appareil compatible et un domaine HTTPS enregistré ; leur présence dans les tests de composants ne constitue pas un paiement Apple Pay ou Google Pay réel.

## Audit de sécurité

npm run test:security exécute les tests d’abus HTTP, de révocation de sessions, de secrets exclus des logs, de cookie HTTPS, de concurrence des mots de passe et de limites du compilateur. tests/security.spec.mjs vérifie la fermeture des accès aux fichiers internes avec un marqueur synthétique et le parcours de révocation dans le navigateur. Les suites attendent le renouvellement du budget de requêtes sans désactiver les limites de production.

Une première génération Noir a également été vérifiée avec une réoptimisation complète du cache Vite. Les entrées de précompilation incluent le worker pour éviter un rechargement tardif qui ferait perdre le formulaire.

Le workflow .github/workflows/security.yml prépare lint, audit npm, tests et parcours compilés sous Node LTS. Son exécution GitHub reste à vérifier après publication de ces fichiers. L’audit complet est décrit dans [AUDIT-SECURITE-2026-11-02.md](AUDIT-SECURITE-2026-11-02.md).

Le job Linux de CI exclut les comparaisons de captures Windows à zéro pixel de différence ; celles-ci restent testées sur Windows. Un déclenchement manuel du workflow ajoute la construction et le test de la distribution portable sur un runner Windows.

## Confort d’utilisation

[INTERFACE.md](INTERFACE.md) décrit les choix d’interface. Chaque nouveau composant et utilitaire dispose de son fichier de test. Les scénarios couvrent les erreurs du presse-papiers, l’annulation et l’échec des confirmations, le thème synchronisé entre consommateurs, le stockage bloqué, les données publiques autorisées à l’impression et le comptage des documents UBL vérifiés.

`tests/usability.spec.mjs` couvre les préférences de l’appareil, le lien d’évitement, la FAQ, le clavier dans le menu mobile, le mot de passe, la recherche locale, la copie d’une empreinte complète et la confirmation avant suppression. Les parcours cryptographiques de `tests/app.spec.mjs` contrôlent aussi le rapport imprimable sur les trois moteurs et produisent un PDF public sur Noir. Pour les lancer : `npx playwright test --config playwright.built.config.mjs tests/usability.spec.mjs tests/app.spec.mjs` après `npm run build`.
