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
- ZK : deuxième adaptateur simulé, sélection explicite, liaison moteur/circuit, option ZK obligatoire, nettoyage du témoin, compilation réelle et preuves falsifiées.
- Serveur : mots de passe historiques, rotation/expiration, isolation des comptes, CSRF, clés publiques valides, erreurs expurgées, concurrence et saturation.
- Stripe : vraies signatures de webhook SDK avec un client Stripe simulé, abonnement autoritatif, annulation, pages de résultats et sessions réutilisées. Aucun paiement externe n’est exécuté.
- Interface : actions des composants, erreurs de saisie, accès à l’abonnement, téléchargement, archivage, vérification et conservation locale des entrées privées.
- Bout en bout : inscription, abonnement, circuit, preuve WASM locale, téléchargement, archivage, vérification sans compte, falsification et expiration.

Les tests utilisent une base en mémoire et un port distinct ; ils ne réemploient pas le serveur ou la base personnels. Le test de migration SQLite crée seulement un dossier temporaire propre au test.

## Non-régression visuelle

tests/visual/dashboard-desktop.png et dashboard-mobile.png sont les captures conservées avant le refactoring. Les tests les comparent avec une tolérance de zéro pixel différent, sans régénérer la référence. Ils couvrent les vues 1440 × 1050 et 390 × 844.

Ces captures ont été prises sous Windows/Chromium ; un autre système ou un changement de moteur de rendu peut produire des différences de police. Examiner toute différence avant une mise à jour volontaire des références. Ne pas remplacer les captures uniquement pour faire réussir un test.

## Ajouter une fonctionnalité

Ajouter son test au même chemin, vérifier le cas valide et les principales erreurs, puis lancer la suite concernée. Pour un moteur ZK, conserver une vraie preuve positive et des tests négatifs sur preuve, contexte et paramètres publics. Pour une route, tester aussi un autre compte et un compte sans abonnement.

Les tests d’architecture empêchent l’import de SDK ZK dans les écrans/domaine et la dispersion du SQL hors de la persistance.
