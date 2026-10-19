# Moteurs de preuve

Le champ **Moteur de preuve** de l’éditeur propose trois implémentations réelles. Le choix est conservé dans la version enregistrée et repris lors de la génération, de l’archivage et de la vérification publique.

| Choix            | Implémentation                                           | Statut et paramètres                                                             |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Noir / UltraHonk | Noir 1.0.0-beta.9, Barretenberg 0.87.0, `keccakZK: true` | Moteur historique, sélectionné par défaut ; paramètres publics Aztec.            |
| Circom / PLONK   | Circom 2.2.3 via `circom2@0.2.23`, `snarkjs@0.7.6`       | Alternative à Noir ; cérémonie universelle PSE.                                  |
| Circom / FFLONK  | Même compilateur Circom et SDK snarkjs                   | Expérimental, conformément au statut du fournisseur ; cérémonie universelle PSE. |

Les trois moteurs calculent la preuve et la vérification dans un Web Worker local. Le serveur compile uniquement la règle publique. Il ne reçoit ni les valeurs privées ni le témoin. Le choix du moteur ne certifie pas la provenance des données.

## Compatibilité

Le champ `engine` est optionnel dans le schéma de circuit v1, sans valeur ajoutée automatiquement aux anciens circuits. Leur empreinte reste inchangée. Un circuit ancien sans ce champ utilise toujours Noir par défaut.

Lorsqu’il est présent, le moteur fait partie de l’empreinte et doit correspondre à celui de l’enveloppe. Changer de moteur crée donc une nouvelle version ; cela ne convertit pas une preuve déjà générée. Les fichiers échangés utilisent l’extension `.clair` ; leur contenu JSON et les protocoles de preuve restent inchangés.

L’enveloppe `clair-proof/1` conserve des paramètres publics hexadécimaux : contexte de 248 bits, puis valeurs publiques dans l’ordre du circuit. Pour Circom, les octets de preuve sont le JSON UTF-8 snarkjs encodé en base64. Aucun témoin, clé de vérification ou chemin de module fourni dans le fichier n’est accepté comme autorité.

## Paramètres publics Circom

La première préparation télécharge **75 590 802 octets, environ 76 Mo**, puis conserve le fichier dans `data/zk-parameters/ppot0080-16.ptau`. Ce téléchargement est effectué par le serveur, pas avec des données utilisateur. Internet est nécessaire au premier usage ; les usages suivants réemploient ce fichier.

Source : fichier de degré 16 de la [cérémonie officielle Perpetual Powers of Tau, contribution 0080](https://github.com/privacy-ethereum/perpetualpowersoftau#prepared-phase-2-files), disponible sur [le stockage PSE](https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_16.ptau).

L’empreinte BLAKE2b-512 suivante a été calculée sur le téléchargement HTTPS depuis cette source officielle, puis verrouillée dans `zk/circom/parameters.mjs` :

```text
9532c6c04a21335577713724b6d46c266a93aa621b78882b8b64b26f3080a8f0d974aded00c4d781adbdf493a45c51db455108f7aeedb49971569d57a56971c3
```

Ce contrôle garantit l’identité du fichier par rapport à cette référence. Il ne constitue pas une validation indépendante complète de la cérémonie. La relecture exhaustive du transcript n’a pas été menée à terme : le beacon utilise 2^31 itérations de hachage et son recalcul est coûteux. La confiance initiale repose sur la distribution officielle PSE et les hypothèses de sa cérémonie.

La taille du téléchargement est bornée à 90 Mio, son délai à deux minutes, et son empreinte est contrôlée avant utilisation. Un fichier corrompu est refusé. Le cache disque ne contient que des paramètres publics, et reste ignoré par Git.

## Compilation, limites et reproductibilité

La compilation Circom et la préparation des clés s’exécutent dans un sous-processus avec délai maximal de trois minutes. Le compilateur WASM a son propre délai d’une minute. Les répertoires temporaires sont supprimés après succès ou erreur. Le cache du service est limité à cinquante résultats et 64 Mio de JSON sérialisé ; les gros résultats ne sont pas conservés.

Le traducteur Circom contraint dans le circuit les booléens, entiers non signés sur 32 bits, débordements, divisions et dates réelles entre 1900 et 2199. Les calculs d’une branche logique doivent être valides même si une autre branche d’un OU suffit à satisfaire la règle.

Les limites générales de l’éditeur restent applicables. Les paramètres de degré 16 introduisent aussi une limite de capacité propre au protocole, particulièrement pour FFLONK, qui utilise davantage de points. Une règle trop volumineuse est refusée explicitement ; réduire sa complexité ou choisir Noir. Aucun repli silencieux vers un autre moteur n’est effectué.

PLONK et FFLONK utilisent une cérémonie universelle et n’exigent pas de nouvelle contribution secrète par circuit. Les clés sont reconstruites à partir du circuit public, du compilateur versionné et des paramètres épinglés. Les tests vérifient qu’une deuxième compilation produit la même clé et accepte les preuves existantes. Toute modification de la clé pour un même circuit nécessite un nouvel identifiant de moteur. Le support de circuits v2 conserve les identifiants existants car la traduction v1 reste inchangée et la version du circuit fait partie de son empreinte.

## Étendre le catalogue

1. Ajouter un descripteur versionné dans `shared/engines.mjs`. Le schéma du domaine et le sélecteur utilisent ce catalogue.
2. Enregistrer le compilateur dans `server/compiler.mjs` et l’adaptateur local dans `src/zk.worker.js`.
3. Respecter le contrat décrit dans [ARCHITECTURE.md](ARCHITECTURE.md), ou introduire une enveloppe versionnée si les paramètres publics ont une autre sémantique.
4. Ajouter les tests du module, les cas cryptographiques négatifs et le parcours Playwright. Préserver les anciens identifiants pour les preuves déjà émises.

La documentation [snarkjs](https://github.com/iden3/snarkjs#readme) décrit les protocoles, leur usage navigateur et le statut expérimental de FFLONK. Les dépendances Circom et snarkjs sont distribuées sous GPL-3.0 ; leurs licences restent applicables à leur distribution.

## Résultats vrais et faux

Les nouveaux circuits de version 2 prouvent l'égalité entre le résultat de leur règle et un booléen public. Une preuve valide peut donc démontrer une condition fausse. Les circuits de version 1 continuent d'exiger une condition vraie ; leur traduction et leurs empreintes restent inchangées. Le mode se choisit dans « Résultat à prouver » et sa modification crée une nouvelle version enregistrée.

L'enveloppe `clair-proof/2` contient `result` (booléen) et `publicData` (identifiant, libellé, type et valeur de chaque entrée publique). Les dates sont au format `YYYY-MM-DD`, les nombres et booléens gardent leurs types JSON. Les entrées privées n'y figurent jamais. Les champs hexadécimaux ne sont pas chiffrés : ils servent à l'encodage cryptographique.

Ordre des paramètres publics : contexte de 248 bits, résultat 0/1, puis entrées publiques dans l'ordre du circuit. L'import contrôle que les champs lisibles correspondent exactement aux paramètres encodés ; la vérification cryptographique contrôle ensuite la preuve et ces paramètres. Le résultat annoncé dans un fichier ne doit être considéré comme prouvé qu'après cette vérification. L'évaluation JavaScript locale fournit des diagnostics ; les contraintes Noir et Circom imposent indépendamment le résultat et les limites de calcul.

## Signatures privées

Seul **Noir / UltraHonk** annonce la capacité `privateSignedInputs`. Le générateur contraint SHA-256 et ECDSA P-256 dans le circuit, avec la clé de la source figée dans sa définition publique. Les attestations privées utilisent `clair-attestation/2` et les preuves `clair-proof/4`. Les autres circuits et enveloppes conservent leurs traductions et leur compatibilité. Voir [SOURCES.md](SOURCES.md) pour le message signé et les paramètres publics supplémentaires.

Circom / PLONK et Circom / FFLONK refusent les entrées signées privées avant compilation, y compris lors d’une sélection de moteur par API ou worker. Aucun repli vers une simple vérification JavaScript n’est autorisé.

## Vérification hors ligne

Le [vérificateur portable Windows](OFFLINE.md) reconstruit et vérifie les circuits des trois moteurs localement, avec les paramètres publics et les clés de confiance incluses au téléchargement. Il ne connaît pas les révocations ultérieures à son instantané.
