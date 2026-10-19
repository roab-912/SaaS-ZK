# Sources de confiance et attestations publiques

Cette version permet d’enregistrer une source avec sa clé publique P-256 et de vérifier ses données publiques signées dans une preuve. La page **Sources de confiance** affiche les sources disponibles, un aperçu FranceConnect grisé et le formulaire d’ajout ou de modification pour l’administrateur. FranceConnect reste un module à venir, sans connexion active ni présence dans les sources sélectionnables des circuits.

## Essayer le parcours

1. Un administrateur enregistre la source et sa clé publique P-256 JWK dans **Sources de confiance**. Pour configurer un administrateur local, ajouter son identifiant de compte à `ADMIN_USER_IDS` dans `.env`, puis redémarrer le serveur. L’identifiant du compte connecté est accessible dans `/api/session`.
2. L’émetteur ouvre **Sources de confiance → Créer une attestation**. Cette page est accessible sans compte ni abonnement. Il choisit sa source, un nom de champ précis comme `income_monthly_eur`, un type et une valeur, puis signe avec sa clé privée. La clé reste locale et est effacée du formulaire après la tentative. Le fichier créé contient une donnée signée, aucune preuve ZK, et est valable sept jours.
3. L’émetteur télécharge le fichier `.attestation.clair.json` et le transmet au destinataire. Un fichier atteste une donnée ; répéter l’opération pour plusieurs champs. La clé privée n’est jamais transmise.
4. Le destinataire crée son circuit en mode **Vrai ou faux**, choisit la source sur l’entrée concernée et renseigne le même nom de champ signé. L’entrée devient publique. Source, empreinte de clé et champ attendu font partie de l’empreinte du circuit.
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

La signature est vérifiée **hors du circuit ZK**. La liaison concerne des entrées publiques : le vérificateur compare exactement la valeur signée au paramètre public contrôlé cryptographiquement par le moteur. La politique de source est liée au circuit par son empreinte. Les entrées signées privées nécessiteront des contraintes supplémentaires.

Les preuves historiques v1/v2 restent compatibles. Un circuit exigeant une signature ne peut pas utiliser une enveloppe v1/v2 sans attestation. Les trois moteurs partagent la couche de provenance dans `zk/operations.mjs`.

## Intégration ultérieure

Un logiciel de facturation ou une banque pourra produire ce format avec sa clé privée conservée dans son propre système, ou utiliser un adaptateur vers un format standard explicitement pris en charge. Le registre de clés publiques est administré côté serveur ; l’application ne propose aucune API serveur de signature.

Pour certifier des entrées privées, ajouter un mécanisme de vérification dans les circuits et versionner les moteurs si leurs contraintes changent. Une identité réelle nécessitera aussi la liaison entre sujet, détenteur et attestation.

Le registre est celui de l’instance Clair utilisée pour vérifier. Vérifier une provenance approuvée nécessite son accès ; un fichier n’embarque pas d’approbation faisant autorité. L’archivage valide le format et ne remplace pas une vérification.
