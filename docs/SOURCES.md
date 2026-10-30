# Sources de confiance et attestations signées

Cette version permet d’enregistrer une source avec sa clé publique P-256 et de vérifier ses données signées dans une preuve, publiques sur les trois moteurs ou privées avec Noir / UltraHonk. La page **Sources de confiance** affiche les sources disponibles, un aperçu FranceConnect grisé et le formulaire d’ajout ou de modification pour l’administrateur. FranceConnect reste un module à venir, sans connexion active ni présence dans les sources sélectionnables des circuits.

## Essayer le parcours

1. Un administrateur enregistre la source et sa clé publique P-256 JWK dans **Sources de confiance**. Pour configurer un administrateur local, ajouter son identifiant de compte à `ADMIN_USER_IDS` dans `.env`, puis redémarrer le serveur. L’identifiant du compte connecté est accessible dans `/api/session`.
2. Le destinataire prépare son circuit en mode **Vrai ou faux**, choisit la source sur les entrées concernées et définit leurs noms de champs signés, par exemple `income_monthly_eur`. Ces entrées deviennent publiques par défaut ; avec Noir / UltraHonk, leur visibilité peut ensuite être passée à **Privée**. Source, empreinte de clé et champ attendu font partie de l’empreinte du circuit. Il utilise **Exporter le circuit public** dans l’éditeur pour transmettre sa structure à l’autorité ; ce fichier ne contient aucune valeur saisie pour une preuve.
3. L’émetteur ouvre **Sources de confiance → Créer une attestation**. Cette page est accessible sans compte ni abonnement. Il sélectionne d’abord sa source : seuls les circuits enregistrés dans son compte qui désignent cette autorité avec sa clé actuelle sont proposés. Il peut aussi utiliser **Importer un circuit public** ; l’import est refusé si le circuit n’attribue aucun champ à cette source. Le formulaire affiche automatiquement les champs attendus de cette autorité avec leurs types et noms signés. Seules les entrées liées à sa clé actuelle sont proposées ; les données déclarées ou destinées à une autre autorité sont exclues. Les champs privés à signer sont identifiés comme tels. La liste des circuits des autres comptes n’est pas publiée.
4. L’émetteur renseigne chaque valeur et importe sa clé privée JWK au format `.clair` ou la colle une seule fois pour signer l’ensemble. La clé reste locale et est effacée du formulaire après la tentative. Il télécharge un fichier `.attestation.clair` par champ et les transmet au destinataire. Chaque fichier contient une donnée signée, aucune preuve ZK, et est valable sept jours. La clé privée n’est jamais transmise. Le choix **Saisir un champ libre (avancé)** conserve la création manuelle sans circuit.
5. Sur **Générer une preuve**, le destinataire utilise le champ de fichier directement visible pour importer l’attestation. La valeur est remplie automatiquement. La signature, les dates et la source approuvée sont contrôlées avant le calcul de la preuve ; aucune clé privée n’est nécessaire au destinataire.
6. Une personne sans compte peut importer la preuve finale dans **Vérifier une preuve**. La provenance affiche le nom de l’émetteur approuvé après vérification.
7. Révoquer une source ou remplacer sa clé retire l’approbation des anciennes attestations lors de leur prochaine vérification. Créer une nouvelle version du circuit pour utiliser une nouvelle clé.

**Signer manuellement avec une clé privée** reste disponible dans un volet replié sous chaque champ signé de la page de génération. Le destinataire utilise généralement le fichier fourni par la source. Le JSON peut aussi être collé dans **Coller une attestation JSON**.

Modifier une valeur chargée retire son attestation : fournir une nouvelle attestation ou signer à nouveau avant de générer. L’attestation est une déclaration de l’émetteur ; elle ne garantit ni sa vérité ni l’identité du porteur. Les fichiers restent copiables et réutilisables pendant leur validité.

## Création des circuits

**Créer un circuit** ouvre un exemple simple : un entier privé `value_1`, comparé à 18. Les modèles majorité, revenus et liste restent accessibles depuis le tableau de bord.

Supprimer une entrée réaffecte ses références dans l’arbre à une entrée restante, en privilégiant le même type. Un message indique cette modification ; vérifier la règle avant de l’enregistrer. La dernière entrée ne peut pas être supprimée. Une référence absente dans un brouillon est signalée dans son sélecteur au lieu d’afficher silencieusement une autre entrée.

## Signature et liaison avec la preuve

`shared/attestations.mjs` définit le protocole applicatif `clair-attestation/1`, utilisant ECDSA P-256 avec SHA-256. Ce format applicatif n’est pas un JWT/JWS ni un format de signature réglementaire.

La clé publique est un JWK strict contenant uniquement `kty`, `crv`, `x`, `y`. Son empreinte est le SHA-256 hexadécimal du JSON compact UTF-8 suivant, dans cet ordre exact :

```text
{"crv":"P-256","kty":"EC","x":"coordonnée_base64url","y":"coordonnée_base64url"}
```

Le message signé est l’UTF-8 de `JSON.stringify` appliqué au tableau suivant, sans espaces :

```text
[format, id, issuerId, keyHash, claim, type, value, issuedAt, expiresAt]
```

- `format` vaut `clair-attestation/1`.
- `id` est un UUID ; `issuerId` correspond au registre ; `keyHash` est l’empreinte ci-dessus.
- `claim` précise la donnée et son unité, par exemple `invoice_total_cents` ou `income_monthly_eur`.
- `type` vaut `number`, `date` ou `boolean`. `value` conserve le type JSON ; les dates sont `YYYY-MM-DD`.
- `issuedAt` et `expiresAt` sont des dates ISO UTC avec suffixe Z. Une attestation future ou expirée est refusée selon l’horloge du vérificateur.
- `signature` contient les 64 octets ECDSA r||s (IEEE P1363), encodés en base64url sans padding. Convertir les signatures DER avant import.
- Le fichier ajoute `publicKey` et `signature`. La clé embarquée permet de vérifier la signature, mais n’accorde aucune confiance sans correspondance avec le registre approuvé.

`clair-proof/3` conserve la preuve et les paramètres publics v2, et ajoute une liste `attestations` de couples `{inputId, attestation}`. Chaque entrée signée exige exactement une attestation. Doublons, ajouts, champs inattendus et clés privées sont refusés. L’import contrôle source, clé, champ, type et valeur. Le worker vérifie ensuite la signature, la période de validité et la clé actuellement approuvée.

Pour les entrées publiques, la signature est vérifiée **hors du circuit ZK**. La liaison concerne des entrées publiques : le vérificateur compare exactement la valeur signée au paramètre public contrôlé cryptographiquement par le moteur. La politique de source est liée au circuit par son empreinte. Noir propose aussi les entrées signées privées selon le protocole décrit ci-dessous.

Les preuves historiques v1/v2 restent compatibles. Un circuit exigeant une signature ne peut pas utiliser une enveloppe v1/v2 sans attestation. Les trois moteurs partagent la couche de provenance dans `zk/operations.mjs`.

## Intégration ultérieure

Un logiciel de facturation ou une banque pourra produire ce format avec sa clé privée conservée dans son propre système, ou utiliser un adaptateur vers un format standard explicitement pris en charge. Le registre de clés publiques est administré côté serveur ; l’application ne propose aucune API serveur de signature.

Étendre les signatures privées à un autre moteur nécessitera des contraintes de vérification équivalentes et des tests cryptographiques. Une identité réelle nécessitera aussi la liaison entre sujet, détenteur et attestation.

Le registre est celui de l’instance Clair utilisée pour vérifier. Vérifier une provenance approuvée nécessite son accès ; un fichier n’embarque pas d’approbation faisant autorité. L’archivage valide le format et ne remplace pas une vérification.

## Fichiers échangés

Les fichiers de l’application utilisent une seule extension : `.clair`. Leur contenu reste du JSON. Le nom précise l’usage sans multiplier les extensions : `majorite.preuve.clair`, `majorite.circuit.clair`, `revenus.attestation.clair` ou `source.cle-privee.clair` pour une clé privée JWK.

Les sélecteurs de fichiers filtrent uniquement les `.clair`, y compris l’import de clés privées. Les schémas, signatures et versions des protocoles restent inchangés.

## Entrées signées privées avec Noir

Dans l’éditeur, choisir **Noir / UltraHonk**, le mode **Vrai ou faux**, une source approuvée puis la visibilité **Privée** du champ. La clé publique de la source est figée dans le circuit en plus de son empreinte. Les autres moteurs ne proposent pas cette combinaison et les appels qui contournent l’interface sont refusés.

Le parcours d’émission reste le même : l’autorité importe le circuit, renseigne la valeur et signe localement avec sa clé P-256. Le formulaire crée automatiquement une attestation `clair-attestation/2` pour un champ privé ; les champs publics conservent `clair-attestation/1`. L’attestation remise au destinataire contient la valeur en clair ; elle doit lui être transmise comme une donnée confidentielle.

Le destinataire importe ce fichier `.attestation.clair`. Noir contraint la signature sur la valeur réellement utilisée dans la règle. Un simple contrôle JavaScript ne suffit jamais à certifier une entrée privée.

Le message signé v2 contient exactement 189 octets, dans cet ordre :

- Le domaine ASCII `clair-private/2:` (16 octets).
- `issuerId` ASCII complété par des zéros à 40 octets, puis `claim` complété à 64 octets.
- Les 32 octets décodés de `keyHash`.
- Le type sur un octet : nombre 0, date 1, booléen 2.
- La valeur sur 4 octets non signés, ordre big-endian : entier, date YYYYMMDD ou booléen 0/1.
- L’UUID `id` sur 16 octets, sans tirets.
- `issuedAt`, puis `expiresAt`, chacun sur 8 octets non signés big-endian : millisecondes Unix.

ECDSA P-256 signe le SHA-256 de ces octets. Le circuit reconstruit le message et son hachage avec le padding SHA-256 standard. La signature est normalisée en low-s à la préparation du témoin pour Noir ; la signature ECDSA équivalente conserve la même validité.

L’enveloppe `clair-proof/4` conserve le circuit, la preuve, le résultat, les données publiques et les attestations des champs publics. Elle n’inclut ni valeur privée, ni signature privée, ni UUID privé. `privateAttestations` expose uniquement `inputId`, `issuedAt` et `expiresAt`. Les paramètres publics sont : contexte, résultat, valeurs publiques dans l’ordre du circuit, puis dates d’émission/expiration pour chaque champ signé privé dans l’ordre du circuit. L’import vérifie la concordance exacte des dates lisibles avec ces paramètres.

La vérification contrôle la preuve ZK, l’approbation courante de la clé et la période de validité. Révocation, remplacement de clé ou expiration rendent la provenance invalide. Les dates publiques peuvent permettre une corrélation ; la valeur et la signature restent cachées. La certification désigne une déclaration signée de la source, pas l’identité du porteur ni la vérité de sa déclaration. Un calcul intégrant une signature peut être plus long qu’un circuit de comparaison seul.

## Relevés de factures

Le module TVA accepte un relevé exhaustif signé par une source P-256 approuvée, qui engage toutes les pièces privées d’une entreprise et d’une période. La signature porte sur un engagement du lot complet ; elle ne publie pas les factures. La source certifie l’exhaustivité et la qualification fiscale, et le circuit vérifie l’engagement, les dates et les calculs. Voir [TVA.md](TVA.md).

## Données UBL

Une facture UBL valide ne constitue pas une source de confiance à elle seule. L’autorité approuvée valide les documents et certifie le relevé complet, dont la version 2 lie les originaux UBL aux données normalisées. Les connexions aux API des plateformes et leurs procédures de clôture restent distinctes de cet import local. Voir [UBL.md](UBL.md).
