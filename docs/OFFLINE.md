# Vérificateur portable hors ligne

## Démontrer le contrôle TVA de janvier sur deux postes

**Pour les participants**, ouvrir **Sources de confiance → Guide et fichiers de la démonstration TVA hors ligne**, ou directement `/?view=demo-tva`. Cette page fournit le lot fictif de janvier, la génération sur le poste de l’entreprise, les deux preuves de référence, les originaux de février et le ZIP Windows associé au registre de la démo. Seul le contrôle sur pièces nécessite la remise des originaux à l’agent.

La commande de préparation ci-dessous publie aussi les fichiers de l’exercice sous `public/demo-tva`. Pour rendre accessible un kit déjà préparé, exécuter `node scripts/publish-vat-demo.mjs session-XXXXXX` avec le nom du dossier de cette session. En mode développement la page est disponible immédiatement. Pour servir une version construite, lancer ensuite `npm run build` et distribuer le répertoire `dist` avec les fichiers de la démo. Le registre de l’application conserve ses propres sources.

**Sur le poste de préparation** (Windows x64, avec la version Node du fichier `.node-version`, les dépendances du projet et Internet), exécuter `npm run demo:tva:offline` depuis la racine du dépôt. La commande construit le logiciel portable, génère une clé de démonstration en mémoire, valide deux jeux de 500 XML fictifs, signe les relevés, produit deux preuves TVA v2 et compare leurs sous-totaux avec ceux des XML. Chaque exécution crée un nouveau dossier sous `data/demo-tva-hors-ligne`. Le chemin exact est affiché à la fin.

1. **Préparer le poste de l’agent.** Copier uniquement le dossier `administration` sur le second poste. Il contient le lanceur, le logiciel, le registre public de démonstration, une fiche de demande et les deux preuves publiques. Garder le dossier `entreprise` sur le premier poste. Couper le Wi-Fi et débrancher Ethernet sur le second poste, puis double-cliquer sur `administration/demarrer.cmd`. L’interface s’ouvre sur l’adresse de boucle locale.
2. **Fixer la demande.** Choisir **Répondre à une demande mensuelle de TVA**. Saisir **FR00000000000** (entreprise A), le mois de janvier de l’année indiquée dans `demande.txt`, puis choisir **Plateforme de démonstration** dans le registre embarqué. La fiche fournit aussi les empreintes de clé et de circuit pour comparaison. Dans un pilote, l’agent obtient ces références par son propre canal de confiance. Le kit utilise le dernier couple janvier/février entièrement clôturé et les relevés sont valables 90 jours à compter de la préparation.
3. **Essayer février pour la demande de janvier.** Ouvrir `fevrier.preuve.clair` et cliquer sur **Vérifier la preuve**. Verdict attendu : « Preuve valide, période différente du mois demandé. » Les deux lots ont la même taille, le même signataire et les mêmes totaux.
4. **Vérifier janvier.** Garder les mêmes critères et ouvrir `janvier.preuve.clair`. Le vérificateur contrôle la preuve et la signature, le programme TVA v2, l’entreprise, les deux bornes exactes du mois et la clé attendue. Il affiche **Demande de TVA satisfaite**, **500 pièces** et **31 917,00 €** de TVA facturée nette des avoirs. Aucun XML n’a été remis à l’agent à ce stade. Conserver le fichier de preuve accepté avec le dossier.
5. **Faire un contrôle sur pièces distinct.** L’entreprise remet cette fois `entreprise/janvier.originaux.clair`. Si l’application a été fermée, rouvrir la preuve de janvier conservée dans le dossier et la vérifier pour la même demande. Dans **Contrôle distinct des originaux**, choisir le lot privé. Le navigateur recalcule l’empreinte de chaque XML, puis celle de l’ensemble ordonné avec le masque privé. Il les rapproche du relevé de la preuve déjà acceptée. Après concordance, sélectionner une pièce pour lire son XML, puis **Fermer les originaux**. Ouvrir le lot de février à cet endroit permet aussi de montrer le refus d’un autre lot signé.

Le contrôle sur pièces lit le lot privé dans le navigateur du poste de l’agent. Il n’envoie pas les XML au serveur local. Fermer les originaux retire le contenu de l’interface ; la copie du fichier remise lors du contrôle reste sur son support. Le verdict porte sur les octets des XML certifiés. L’examen du contenu fiscal appartient à l’agent.

Le scénario suppose une seule clôture signée par entreprise et par mois. Hors ligne, le registre de clés reflète sa date d’export. Le programme rattache la TVA à la date des factures et avoirs, selon le périmètre documenté dans [TVA.md](TVA.md).

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

## Runtime après l’audit

Construire avec la version LTS corrigée de .node-version. Les versions non maintenues et celles antérieures aux minima de server/runtime-policy.mjs sont refusées. Le serveur ne propose plus une archive dont le champ nodeVersion correspond à une version refusée : reconstruire le logiciel après mise à jour de Node et des dépendances. Les utilisateurs ayant déjà téléchargé une ancienne archive doivent la remplacer ; le mode hors ligne ne peut pas recevoir automatiquement cette mise à jour.
