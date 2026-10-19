# Vérificateur portable hors ligne

## Utiliser le logiciel

Dans **Sources de confiance**, **Télécharger le vérificateur hors ligne** fournit le logiciel et toutes les sources actuellement approuvées. Le lien placé sur une source n’embarque que sa clé ; pour une preuve faisant intervenir plusieurs autorités, choisir le téléchargement global.

La distribution actuelle cible **Windows 64 bits**. L’archive ZIP fait environ **280 Mio**, car elle contient Node.js, les trois moteurs, leurs compilateurs et les paramètres publics nécessaires. Aucun compte, abonnement, téléchargement complémentaire ou installation de Node n’est demandé à l’utilisateur.

1. Télécharger le logiciel depuis votre instance Clair de confiance.
2. Extraire toute l’archive ZIP, puis lancer **demarrer.cmd**. Le premier lancement extrait automatiquement `logiciel.zip` dans un dossier `logiciel`.
3. Le navigateur ouvre une interface locale. Choisir un fichier de preuve **.clair**, éventuellement renseigner l’empreinte du circuit attendue, puis vérifier.
4. Examiner le circuit, le résultat **Vrai/Faux**, les valeurs publiques et les sources vérifiées selon le registre téléchargé.
5. Fermer la console avec **Ctrl+C** pour arrêter le logiciel.

Le lancement peut aussi s’effectuer sans ouverture automatique du navigateur, depuis le dossier `logiciel` :

```powershell
.\node.exe --import ./offline/network.mjs ./offline/server.mjs --trust ../sources.clair --no-browser
```

L’adresse locale est affichée dans la console. Le logiciel n’écoute que sur `127.0.0.1` et choisit un port disponible. Les vérifications s’exécutent dans des processus séparés ; aucune preuve n’est envoyée au SaaS. La page ne charge aucun service distant et les téléchargements réseau des moteurs sont bloqués.

## Confiance et validité

`sources.clair` contient un instantané `clair-trust/1` du registre : origine de l’instance, date d’export, identifiants, noms, clés publiques P-256 et empreintes SHA-256. Les clés ne proviennent jamais librement du fichier de preuve. La distribution doit être obtenue depuis une instance que vous reconnaissez comme autorité pour ce registre ; l’instantané n’est pas signé par une autorité racine indépendante.

Le logiciel vérifie la preuve ZK, reconstruit le circuit et sa clé de vérification avec ses compilateurs, puis contrôle les signatures, les clés approuvées de l’instantané et les dates. Il prend en charge Noir / UltraHonk, Circom / PLONK, Circom / FFLONK et les entrées signées privées Noir. Il n’accepte pas une clé de vérification arbitraire embarquée dans une preuve.

**Sans connexion, une révocation ou un remplacement de clé postérieur à l’export reste inconnu.** Retélécharger le logiciel permet de mettre à jour les sources. La validité temporelle des attestations dépend de l’horloge locale. Une preuve valide peut annoncer un résultat faux ; il faut vérifier que la condition demandée est satisfaite et que le circuit est celui attendu.

La valeur, la signature et l’identifiant d’une attestation privée ne figurent pas dans la preuve. Sa source et ses dates restent publiques. Les preuves déclarées restent vérifiables sans source de confiance ; elles ne certifient pas l’origine des données.

Les fichiers de données conservent l’extension **.clair**. Le logiciel est distribué en **ZIP** pour permettre une extraction native sous Windows.

## Préparer et tester la distribution

Depuis le dépôt sous Windows x64 :

```powershell
npm ci
npm run build:offline
npm run test:offline
```

La construction exige Internet pour obtenir les paramètres publics et la licence Node.js. Elle conserve un cache de paramètres dans `data/offline-cache/`. Les paramètres PSE Circom sont contrôlés avec l’empreinte BLAKE2b-512 épinglée du projet. Le logiciel vérifie au démarrage les tailles et SHA-256 de ses paramètres inclus. Le CRS Noir embarque les points BN254 jusqu’à `2^21 + 1` ; un calcul dépassant les ressources incluses échoue explicitement, sans téléchargement.

Les sorties `data/offline/logiciel.zip` et `release.json` doivent être déployées ensemble sur le serveur. Elles ne contiennent aucun compte, session, fichier utilisateur ni `.env`. Le serveur ajoute uniquement un instantané public courant des sources à chaque téléchargement. La distribution embarque les sources JavaScript et les licences livrées avec ses dépendances, ainsi que la licence de Node.js.

L’archive doit être reconstruite après une modification de `offline/`, `shared/`, `zk/`, des versions de dépendances ou de Node. Si elle n’est pas construite, l’interface n’affiche pas de lien mort : elle indique que le logiciel est en préparation. Un serveur SaaS sous un autre système peut distribuer l’artefact Windows préconstruit.

`npm run test:offline` reconstruit le logiciel, télécharge sa véritable archive via HTTP, l’extrait dans un dossier temporaire hors du dépôt avec l’outil Windows utilisé par le lanceur, puis exécute le Node embarqué. Le test vérifie les trois moteurs, une signature privée Noir et une falsification, avec le réseau des moteurs bloqué. Le navigateur du test refuse aussi toute requête sortant du serveur local.
