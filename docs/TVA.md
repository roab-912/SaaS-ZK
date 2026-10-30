# Preuve de TVA collectée — prototype

## Utilisation

Relancer le serveur avec demarrer.cmd après installation de cette version, puis recharger le navigateur. Le module ajoute un programme Noir dédié ; les anciens circuits et formats de preuve restent compatibles.

1. Un administrateur approuve la clé publique P-256 de la plateforme dans Sources de confiance. La clé privée reste chez l’émetteur.
2. Ouvrir **Sources de confiance → Certifier des factures**, ou **Mes circuits → TVA collectée → Importer mes factures XML**.
3. L’autorité renseigne la période en jj/mm/aaaa, puis importe de 1 à 500 factures et avoirs XML UBL. Pour une démonstration, elle peut télécharger des exemples UBL, décompresser le ZIP et sélectionner ses XML. Le fournisseur est déduit des documents.
4. Après vérification des pièces, elle confirme explicitement l’exhaustivité pour l’entreprise et la période clôturée, puis signe avec sa clé privée. Le formulaire efface la clé après l’opération. Le relevé est valable 90 jours dans cet outil de démonstration.
5. Dans le parcours guidé, **Continuer vers ma preuve** transmet directement le lot signé en mémoire locale. Pour une remise externe ou une sauvegarde, elle télécharge **Factures.certifiees.clair**. Ce fichier contient les factures privées, le masque de confidentialité et le relevé public signé. Le conserver pour un éventuel contrôle ; il n’est pas destiné au vérificateur public.
6. L’entreprise poursuit directement vers la preuve, ou importe un lot reçu avec **J’ai déjà un lot signé**. Elle confirme le montant collecté après avoirs, puis génère une preuve sur son appareil.
7. Elle partage **TVA.preuve.clair**. Toute personne peut l’importer dans Vérifier une preuve, sans compte. La preuve peut aussi être archivée dans Mes preuves.

La signature du lot n’exige pas de compte payant. La génération et l’archivage suivent les quotas de l’abonnement. Ouvrir le modèle ou certifier le lot n’enregistre aucun circuit. Le programme est enregistré au lancement de la génération ; une capacité identique est réutilisée. Les capacités sont 10, 50, 100, 250 et 500 pièces, choisies automatiquement selon le nombre de factures.

## Périmètre de calcul

- Ventes et avoirs uniquement, en euros ; le résultat est la TVA des ventes moins la TVA des avoirs.
- Taux du programme : 20 %, 10 %, 5,5 % et 2,1 %. Les fournisseurs étrangers sont acceptés lorsque leurs données utilisent ces taux. Un poste sans TVA est accepté avec un motif certifié par l’autorité. Les catégories UBL AE (autoliquidation) et G (export) contribuent pour zéro à la TVA facturée du vendeur.
- Une facture peut comporter jusqu’à cinq postes : une base HT regroupée pour chacun des taux pris en charge, y compris le poste sans TVA. Les bases sont nettes des réductions déjà appliquées par l’émetteur.
- Les montants sont des **centimes entiers**. Pour chaque facture et chaque taux, la taxe attendue est : `(baseHTCentimes × tauxPointsDeBase + 5000) / 10000`, avec division entière. L’arrondi est donc au centime le plus proche, demi-centime vers le haut. L’avoir utilise le même calcul sur des valeurs positives et est soustrait au total.
- Les dates de facture et d’avoir sont incluses entre le début et la fin de période. Le relevé ne peut être signé avant la fin du dernier jour de cette période, en UTC.
- Un avoir référence une facture distincte, qui peut appartenir à une période antérieure. Les identifiants sont uniques dans le relevé certifié. Le prototype ne recalcule pas le solde historique d’une facture référencée dans une autre période.
- Une base par taux est limitée à 1 000 000,00 €. Les totaux TVA des ventes et TVA des avoirs sont chacun limités à 42 949 672,95 €. Le solde peut être négatif ; ce solde analytique n’est pas une instruction de saisie de la déclaration fiscale.
- Un lot comporte au moins une pièce, au maximum 500. Les doublons, taxes incorrectes, taux non pris en charge, dates invalides et pièces hors période sont rejetés.

Ce programme fixe ces règles d’arrondi et de rattachement pour le PoC. Il ne sélectionne pas le taux légal selon la nature d’un bien : cette qualification est certifiée par l’autorité. Il ne calcule pas la TVA à autoliquider par l’acquéreur. Il ne couvre pas la TVA sur encaissements, la déduction des achats, les autres régimes intracommunautaires, les devises, les régimes particuliers de Corse et d’outre-mer ou le remplissage de CA3.

Références de cadrage : [taux de TVA en France](https://www.economie.gouv.fr/entreprises/gerer-sa-fiscalite-et-ses-impots/autres-impots-et-taxes/entreprises-ce-que-vous-devez-savoir-sur-la-tva), [traitement fiscal des avoirs](https://www.impots.gouv.fr/professionnel/questions/comment-traiter-une-facture-davoir-sur-ma-declaration-de-tva). L’arrondi décrit ci-dessus est une convention explicite de ce prototype, pas une affirmation de couverture de toutes les pratiques de facturation.

## Ce que prouve l’ensemble

Le fichier public associe deux vérifications :

1. **Signature P-256 du relevé** : l’autorité approuvée certifie l’entreprise, la période clôturée, le périmètre ventes/avoirs, la devise, la convention d’arrondi, le nombre de pièces et l’engagement du lot complet. La signature, la clé courante du registre et les dates de validité sont revérifiées à chaque contrôle.
2. **Preuve Noir / UltraHonk** : les pièces privées reconstituent exactement l’engagement signé ; leurs dates et leurs taxes respectent le programme, puis leurs sommes correspondent aux montants publics.

Le circuit contrôle aussi le remplissage nul des emplacements inutilisés. Ajouter, enlever, remplacer, dupliquer ou réordonner une pièce par rapport au relevé signé modifie l’engagement ou le nombre certifié et empêche la preuve. Les contrôles de l’émetteur rejettent les identifiants dupliqués avant signature.

L’engagement est une chaîne de hachages Poseidon2, utilisant le primitif natif de Noir et le même encodage Barretenberg côté émetteur. Il lie l’entreprise, la période, le nombre de pièces, l’ordre et les métadonnées des pièces, leurs bases et taxes. Un masque privé aléatoire protège les lots de faible entropie. Les identifiants, références d’avoirs et motifs sont engagés par des empreintes SHA-256 projetées dans le corps scalaire. Le programme générique d’arbres logiques conserve ses limites ; la matrice de 500 pièces appartient uniquement au programme TVA figé. Dans le descripteur JSON, la présence de vat impose ce programme spécialisé et sa capacité ; le champ root réservé n’exprime pas à lui seul ces contraintes. La compilation et la vérification doivent utiliser ce programme dédié. Les cinq descripteurs autorisés sont fixes, y compris le nom et la description, pour borner le coût de compilation publique.

Une seule signature sur l’engagement authentifie toutes les pièces du lot. Cette version ne vérifie pas 500 signatures ECDSA indépendantes dans le circuit. Un connecteur réel devra vérifier les factures de son système, construire le relevé exhaustif et le signer selon ce contrat.

**Limite de confiance :** la preuve établit la présence de toutes les pièces du relevé signé. C’est l’autorité qui certifie que ce relevé contient toutes les pièces de l’entreprise pour la période. La cryptographie ne peut pas détecter une facture que l’autorité ignore ou qu’elle a volontairement omise avant de signer. Elle ne prouve pas non plus qu’aucune version plus récente d’un relevé n’a été émise ; un registre des clôtures et révisions reste une évolution possible.

Les informations publiques sont l’entreprise, la période, le nombre de pièces, les deux sous-totaux et leur différence, l’autorité, les dates et la signature du relevé, son engagement et le circuit. Le détail de chaque pièce, son identifiant et le masque restent privés. Le serveur ne reçoit que le circuit public et, si demandé, la preuve publique archivée.

## Formats réutilisables

Les factures entrantes utilisent leur format natif **UBL XML** (.xml). Les brouillons de factures .clair ne sont plus proposés à l’import ou à l’export. Les données normalisées du circuit restent un format interne en centimes.

Le lot certifié `clair-vat-batch/2` utilise l’extension .clair et contient `manifest`, `blinding`, `invoices` (données normalisées) et `documents` (originaux UBL privés). Cette enveloppe transporte la certification de l’autorité ; elle ne remplace pas UBL comme format de facture.

Le relevé public `clair-vat-manifest/2` lie l’entreprise, la période, le nombre de pièces, l’engagement des données normalisées, l’engagement des XML originaux, les versions de validation, l’émetteur et sa signature. Les contrats exacts sont dans shared/vat.mjs et shared/vat-documents.mjs. La clé privée du signataire n’est jamais ajoutée au lot.

Le parcours de création exige un lot version 2 avec ses originaux UBL. Les anciens relevés restent vérifiables dans les preuves déjà émises. Les connecteurs Factur-X, CII et les API de plateformes de facturation restent à développer. Voir [UBL.md](UBL.md) pour le contrat UBL.

La preuve `clair-proof/vat-1` contient le circuit TVA, les paramètres publics, les valeurs lisibles, le relevé signé et la preuve UltraHonk. Les enveloppes standard clair-proof/1 à clair-proof/4 ne changent pas. Les règles de ce programme et de ses formats doivent rester figées ; une évolution fiscale ou d’encodage doit créer une version de programme et de format distincte, sans modifier silencieusement la signification des preuves existantes.

Le vérificateur portable sait aussi reconstruire ce programme et vérifier le relevé avec son registre embarqué. Régénérer sa distribution avec `npm run build:offline` pour inclure cette fonctionnalité. Hors ligne, la confiance et la révocation sont celles de l’instantané téléchargé, selon le fonctionnement décrit dans OFFLINE.md.

## Validation

Les tests couvrent les règles métier, la signature et la révocation, les dates, les montants, les doublons et omissions, la confidentialité des requêtes, les quotas et l’archivage.

- `tests/zk/noir/vat-source.test.mjs` exécute réellement Noir avec des témoins altérés : dates, taxes, pièces manquantes ou dupliquées et remplissage non nul.
- `tests/vat-crypto.test.mjs` génère et vérifie réellement une preuve de 500 pièces, puis rejette une signature incorrecte et une source retirée du registre.
- `tests/vat.spec.mjs` couvre le parcours navigateur complet, de la signature émetteur à la vérification anonyme, pour 500 pièces.

Premier essai local Node, un thread, 500 pièces de démonstration : compilation environ 5 s, génération et contrôle de la preuve environ 62 s, preuve binaire d’environ 16 Ko. Ce relevé mesure une machine de développement, sans garantir le même temps sur un autre appareil. Le parcours navigateur est également testé séparément.

## Import des factures UBL

Le parcours de certification accepte désormais les XML UBL 2.1 EN16931 et Peppol BIS Billing 3.0 dans le périmètre du circuit. Les originaux sont conservés dans un lot privé version 2 et leurs empreintes sont liées au relevé signé, sans modifier le programme Noir existant. Pour créer une nouvelle preuve dans l’interface, le lot doit contenir ses originaux UBL. Les preuves existantes restent vérifiables. Voir [UBL.md](UBL.md) pour le parcours, les profils, la validation locale et la limite de confiance sur l’exhaustivité.
