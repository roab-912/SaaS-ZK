# Clair — MVP de preuves zero knowledge

SaaS en français : comptes personnels, abonnement, éditeur de circuits imbriqués, preuves réellement calculées dans le navigateur, fichiers téléchargeables et vérification publique.

## Organisation et maintenance

Le code est séparé entre domaine, écrans React, services serveur, persistance et adaptateurs ZK. Chaque module exécutable possède un test dédié.

- [Architecture et ajout d’un moteur ZK](docs/ARCHITECTURE.md)
- [Moteurs disponibles, choix et paramètres publics](docs/ENGINES.md)
- [Contrôles de sécurité et limites](docs/SECURITY.md)
- [Tests, couverture et non-régression visuelle](docs/TESTING.md)

## Démarrer

Prérequis : Node.js 22.13 ou ultérieur (SQLite natif ; testé avec Node 25.4).

```powershell
npm install
npm run dev
```

Ouvrir http://localhost:3000. Créer un compte avec un mot de passe d’au moins 12 caractères, puis activer les 30 jours de démonstration dans **Mon abonnement**. Aucun paiement ni compte externe n’est nécessaire pour ce parcours.

Les comptes sont conservés dans **data/clair.sqlite**. Les tests utilisent une base en mémoire. Ne pas mettre data/ ou .env dans Git.

## Choisir un moteur ZK

Dans l’éditeur de circuit, le champ **Moteur de preuve** propose **Noir / UltraHonk** (par défaut), **Circom / PLONK** et **Circom / FFLONK** (expérimental). Le choix est conservé avec la version du circuit et utilisé automatiquement lors de la génération et de la vérification. Les anciens circuits et fichiers restent compatibles.

Après cette mise à jour, exécuter `installer.cmd` pour installer les nouvelles dépendances, puis `demarrer.cmd`. La première preuve Circom télécharge environ 76 Mo de paramètres publics côté serveur ; les calculs sur les données privées restent dans le navigateur. Voir [les détails et limites des moteurs](docs/ENGINES.md).

## Parcours disponibles

- Inscription, connexion, session HttpOnly de sept jours et déconnexion.
- Abonnement de démonstration activable/désactivable ; accès contrôlés côté serveur.
- Stripe : Checkout, portail client, webhooks signés, synchronisation de l’état et réutilisation d’une session de paiement ouverte.
- Entrées privées/publiques : entier positif, date ou booléen.
- Comparaisons =, ≠, >, ≥, <, ≤ ; ET, OU, XOR, NON ; +, −, ×, division entière, modulo ; appartenance à une liste.
- Versions immuables des circuits ; une modification crée une nouvelle version.
- Preuve locale dans un Web Worker, contrôle automatique après génération, annulation et délai maximal de cinq minutes.
- Téléchargement .clair, enregistrement explicite et consultation des preuves du compte.
- Vérification sans compte, consultation du circuit et des paramètres publics, comparaison facultative à une empreinte attendue.
- Registre administrateur des émetteurs approuvés et attestations signées pour les entrées publiques.

## Stripe en mode test

Copier .env.example vers .env, puis renseigner :

```dotenv
APP_URL=http://localhost:3000
BILLING_MODE=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
ALLOW_LIVE_PAYMENTS=false
```

Créer un produit et un prix **récurrent** dans l’environnement de test Stripe. Activer le portail client dans ce même environnement. Le tarif au paiement provient du prix Stripe ; aucun montant n’est codé dans le client.

Avec la CLI Stripe authentifiée :

```powershell
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Utiliser le secret whsec_ affiché par la CLI, puis redémarrer le serveur. La carte de test 4242 4242 4242 4242, une date future et un CVC quelconque permettent de tester un paiement réussi. Le retour de Checkout ne suffit jamais à accorder l’accès : le serveur consulte l’état actuel de l’abonnement. [Stripe Checkout](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [webhooks](https://docs.stripe.com/webhooks), [cartes de test](https://docs.stripe.com/testing).

Événements traités : checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid et invoice.payment_failed. Les notifications répétées ou anciennes entraînent une relecture de l’état actuel. L’accès est réservé aux états active ou trialing avant la fin de période, sans période de grâce pour les autres états.

Les tests vérifient le contrat d’intégration avec un client Stripe simulé et de véritables signatures de webhook SDK. Un paiement bout en bout sur un compte Stripe n’a pas été effectué : il nécessite vos clés et votre prix de test.

## Cryptographie et confidentialité

L’arbre public est validé puis traduit en Noir ou en Circom selon le moteur choisi. La compilation ne reçoit aucune valeur privée. Un SHA-256 canonique identifie la version complète, y compris les libellés, types et visibilités. Les 248 premiers bits sont aussi contraints comme entrée publique du programme.

Avec le moteur par défaut, le navigateur exécute le circuit avec NoirJS, génère une preuve UltraHonk **avec keccakZK: true**, puis la vérifie avant téléchargement. La même option est imposée lors de la vérification. Les versions Noir 1.0.0-beta.9 et Barretenberg 0.87.0 sont verrouillées et testées ensemble. Le fichier identifie son moteur. [Exemples officiels Noir](https://github.com/noir-lang/noir-examples), [code Barretenberg](https://github.com/AztecProtocol/aztec-packages).

Le vérificateur reconstruit le circuit depuis l’arbre embarqué via le compilateur public et dérive sa clé de vérification. Il n’accepte pas une clé ou un programme arbitraire du fichier. Une modification de l’énoncé, des paramètres publics ou de la preuve doit être rejetée.

Les entrées privées et le témoin intermédiaire restent dans le navigateur. Le témoin est effacé après génération ; le worker est terminé et le formulaire privé réinitialisé. JavaScript ne garantit pas l’effacement physique de toutes les copies en mémoire. Aucun outil de télémétrie ni police externe n’est chargé.

Les paramètres publics sont téléchargés depuis crs.aztec.network. Le calcul est local, mais une connexion reste nécessaire pour compiler le circuit public et charger ces ressources. Ce MVP ne promet pas une vérification entièrement hors ligne.

Le serveur conserve les comptes, sessions, statuts de facturation, circuits publics et fichiers explicitement enregistrés. Les constantes, noms et descriptions des circuits sont publics : ne pas y placer de secrets. Un fichier n’est pas considéré comme vérifié simplement parce qu’il est enregistré.

## Sens d’une preuve réutilisable

Une preuve démontre que la règle produit le résultat annoncé pour ses paramètres publics et des valeurs privées. Avec des entrées déclarées, elle ne garantit pas leur véracité, leur origine ni leur appartenance à la personne qui présente le fichier.

Le modèle de majorité compare une date de naissance privée à une date limite publique. Le destinataire doit vérifier la cohérence de cette limite avec son seuil et sa date de référence. Le titre « majorité » n’est pas une garantie. Le fichier n’expire pas automatiquement : il peut être revérifié dans six mois, mais la pertinence dépend de ses paramètres. Une preuve réutilisable peut être copiée et corrélée.

## Sources signées et futurs connecteurs

Les circuits acceptent les entrées déclarées et les entrées publiques signées par une source approuvée. L’écran de vérification affiche une origine vérifiée après contrôle de la signature, de la valeur publique, de l’expiration et du registre courant.

Ajouter les **identifiants de comptes** administrateurs dans ADMIN_USER_IDS, séparés par des virgules, puis redémarrer. L’identifiant est visible dans /api/session après connexion. Une adresse e-mail non vérifiée n’accorde jamais les droits administrateur.

Le registre conserve une clé publique JWK P-256 et un état approuvé/révoqué. Pour les entrées publiques, le vérificateur contrôle la signature hors du circuit et compare sa valeur au paramètre public de la preuve ZK. Les entrées signées privées restent à développer et nécessiteront des contraintes cryptographiques supplémentaires. Voir [SOURCES.md](docs/SOURCES.md).

## Tests et build

```powershell
npm run lint
npm run format:check
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run build
npx playwright test --config playwright.built.config.mjs
```

Tests : preuves réelles et falsifiées, paramètres publics modifiés, dates invalides, dépassements arithmétiques, types et profondeur, isolation des comptes, expiration, protection d’origine, cycle Stripe simulé, parcours navigateur complet. Le test navigateur vérifie l’absence de la date privée dans le fichier téléchargé et dans les requêtes API.

**npm run preview** sert le build pour un essai local en mode démonstration.

## Déploiement

```powershell
npm run build
npm start
```

npm start active les contrôles de production : le mode démonstration est refusé. Configurer Stripe (mode test possible en préproduction), APP_URL en HTTPS et un stockage persistant pour DB_PATH. HOST vaut 127.0.0.1 par défaut ; le configurer si nécessaire derrière le proxy. Le proxy doit conserver COOP/COEP. Ne pas exposer le serveur de développement.

Les paiements réels exigent ALLOW_LIVE_PAYMENTS=true et les clés, prix et secret webhook de l’environnement réel. Sauvegarder SQLite et utiliser un seul processus applicatif dans ce MVP. Plusieurs instances nécessiteraient une base, des limites de débit et des verrous de paiement partagés.

## Limites

- 12 entrées, 64 blocs, 10 niveaux, 32 éléments par liste.
- Entiers non signés sur 32 bits ; pas de décimales, négatifs, chaînes ni expressions libres.
- Dates entre 1900 et 2199, contrôlées dans le circuit.
- Pas de court-circuit : une division invalide bloque aussi une branche inutilisée d’un OU.
- Les attestations signées concernent uniquement les entrées publiques ; les connecteurs métier, le contrôle du détenteur et la protection contre la copie restent à développer.
- Pas encore de vérification d’e-mail, récupération de mot de passe ni espace d’équipe.
- Bibliothèques cryptographiques en préversion, verrouillées pour leur compatibilité. Une ouverture publique nécessite une revue de sécurité du produit et du compilateur.
- Le calcul local est reproductible par quelqu’un conservant le code et le circuit. L’abonnement contrôle le service et les parcours du SaaS ; il n’est pas un verrou cryptographique sur une opération locale.

### Résultats et diagnostics

Les nouveaux circuits utilisent par défaut « Vrai ou faux » : une preuve valide peut démontrer que la condition est fausse. L'écran de vérification distingue ces deux informations. Les anciennes règles restent en mode « Vrai uniquement » ; ouvrez-les dans l'éditeur pour changer ce mode et enregistrer une nouvelle version.

Les nouveaux fichiers de preuve contiennent un résultat booléen `result` et les entrées publiques lisibles dans `publicData`. L'encodage hexadécimal de `publicInputs` est conservé pour les moteurs cryptographiques. Aucune entrée privée n'est ajoutée à l'export.

En développement, `demarrer.cmd` lance Node sans le mode `--watch`, pour éviter les redémarrages en boucle avec Vite. Vite actualise l’interface ; après une modification du serveur, du domaine partagé ou des moteurs ZK, redémarrez manuellement le serveur. Si un ancien serveur tourne déjà, arrêtez-le une fois avec **Ctrl+C**, relancez **demarrer.cmd**, puis rechargez la page. Le client détecte un serveur obsolète et affiche cette marche à suivre. Les erreurs de validation indiquent les champs concernés ; les erreurs de sauvegarde et de génération restent visibles dans leur formulaire.

### Sources de confiance

Le registre accepte des clés publiques P-256 approuvées par l’administrateur. Les émetteurs choisissent leur source depuis « Sources de confiance → Créer une attestation », puis un circuit qui la désigne comme autorité. Ils renseignent uniquement les champs attribués à cette source et les signent avec une seule clé privée. Une autorité externe peut importer le circuit public exporté depuis l’éditeur, sans compte ni preuve ZK. Un fichier signé est téléchargé pour chaque donnée. Le destinataire importe ce fichier dans la génération de sa preuve ; la signature manuelle y reste disponible dans un volet replié. La vérification affiche la source et contrôle les signatures, les valeurs, l’expiration et l’approbation actuelle. Les connecteurs FranceConnect, banque et facturation restent à développer. Voir [le parcours complet et le format de signature](docs/SOURCES.md).
