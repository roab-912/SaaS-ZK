# Import UBL et certification des factures

## Parcours

L’import UBL est disponible dans **Sources de confiance → Certifier des factures**, également accessible depuis le modèle **TVA collectée certifiée**.

1. Renseigner le début et la fin de la période à certifier, en jj/mm/aaaa.
2. Sélectionner les factures et avoirs avec **Importer des factures UBL**. Plusieurs fichiers .xml peuvent être choisis ensemble.
3. Clair valide et lit les fichiers sur l’appareil, puis déduit l’identifiant du fournisseur et les données du circuit TVA. Les montants ne sont jamais corrigés automatiquement.
4. Consulter le résultat, les avertissements et les documents originaux. L’identifiant de l’entreprise est déduit des factures.
5. L’autorité approuvée confirme l’exhaustivité et signe le relevé avec sa clé privée. Elle remet le lot certifié .clair à l’entreprise.
6. L’entreprise importe ce lot dans le modèle TVA et génère la preuve. Les XML restent privés et sont retirés du formulaire après génération. Conserver le lot d’origine pour un éventuel contrôle.

Le bouton **Télécharger des exemples UBL** crée une archive ZIP de données fictives, selon la période et le nombre choisis. Décompresser cette archive avant de sélectionner les fichiers XML. Ce premier import ne lit pas directement les ZIP.

L’extension .xml est utilisée pour les documents UBL natifs. Seuls les lots certifiés et les preuves utilisent l’extension .clair pour conserver le relevé signé. L’ajout de factures accepte uniquement les XML UBL ; l’import et l’export de brouillons de factures .clair ont été retirés. Aucun fichier de facture n’est envoyé au serveur.

## Périmètre pris en charge

- UBL 2.1 Invoice avec le code 380 et CreditNote avec le code 381.
- Identifiant de spécification EN16931 standard : `urn:cen.eu:en16931:2017`.
- Peppol BIS Billing 3.0 : `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`.
- UTF-8, EUR, fournisseurs français ou étrangers ; son identifiant est extrait du numéro de TVA, ou de l’identifiant légal s’il n’existe pas de numéro de TVA. Tous les fichiers du lot doivent employer le même identifiant de fournisseur.
- Catégorie S aux taux du circuit actuel : 20 %, 10 %, 5,5 %, 2,1 %. Catégories E (exonération), Z (taux zéro), AE (autoliquidation) et G (export) à taux zéro et TVA facturée nulle, avec conservation des catégories et motifs dans les XML originaux. Pour le calcul TVA, leurs bases sont regroupées dans le poste sans TVA du circuit existant.
- Bases et taxes extraites des ventilations TVA du document, qui intègrent les réductions et charges du document. Les règles EN16931 contrôlent notamment les liens entre lignes, réductions, charges et totaux.
- Un avoir doit référencer une seule facture d’origine. Cette facture peut appartenir à une période antérieure.
- Les montants sont convertis exactement en centimes entiers. Le circuit continue d’exiger son arrondi par facture et par taux. Un écart, même sur un document admis par d’autres tolérances métier, est expliqué et refusé.
- Jusqu’à 500 documents, 2 Mo par XML et 25 Mo de XML au total. Les lots .clair contenant les originaux sont limités à 40 Mo à l’import.

Les autres profils, dont EXTENDED-CTC-FR et les CIUS nationales non implémentées, sont refusés explicitement. Les règles françaises supplémentaires XP Z12-012 ne sont pas validées. La validation Peppol concerne le document : elle ne valide pas le transport, l’annuaire ou l’enveloppe du réseau Peppol.

Les catégories AE et G contribuent pour zéro à la somme de TVA facturée du vendeur. Le circuit ne calcule pas la TVA que l’acquéreur pourrait devoir autoliquider, ne détermine pas l’éligibilité fiscale à ces catégories et ne choisit pas les taux légaux d’un pays. Cette qualification demeure certifiée par l’émetteur. Les catégories K et O, les taux autres que ceux du circuit (notamment 19 % et 7 %), les devises comptables de TVA distinctes, les montants négatifs et les types documentaires hors 380/381 restent exclus. Les limites et exclusions fiscales générales du circuit restent celles de [TVA.md](TVA.md), notamment le rattachement à la date de facture et l’absence de déclaration CA3.

## Validation locale

Trois contrôles sont appliqués :

1. Lecture XML sécurisée et identification par les espaces de noms officiels, indépendamment des préfixes choisis dans le document.
2. Validation contre les XSD UBL 2.1 officiels d’OASIS, avec libxml2 WebAssembly.
3. Exécution des règles Schematron officielles EN16931 1.3.17, complétées par Peppol 3.0.21 lorsque le document déclare ce profil. Les règles sont précompilées pour SaxonJS 2.7 et s’exécutent localement. Les erreurs bloquent l’import ; les avertissements restent consultables.

Les XML non conformes restent rejetés, même lorsqu’ils proviennent d’un générateur tiers. Clair ne réordonne pas les balises et ne corrige ni codes, ni identifiants, ni montants à l’import. Une note de document située après DocumentCurrencyCode est notamment invalide ; le message indique sa position attendue. Une copie corrigée par l’émetteur doit repasser tous les contrôles. Les exemples anonymisés sous tests/fixtures/ubl représentent des versions corrigées, et les tests réintroduisent leurs défauts pour vérifier leur rejet.

Les DTD, entités déclarées, instructions de traitement et XML excessivement profonds ou complexes sont refusés avant construction du DOM. La validation XSD utilise exclusivement les schémas embarqués ; les références de schémas contenues dans une facture ne servent pas à charger des ressources. Les documents sont traités successivement et peuvent être annulés entre deux pièces.

Les ressources officielles et leurs empreintes sont enregistrées dans vendor/ubl/assets.json. Les schémas sources sont conservés dans public/ubl/xsd ; les règles sources dans vendor/ubl. Les fichiers compressés destinés au navigateur sont dans public/ubl.

Après installation des dépendances, ils peuvent être reconstruits sans télécharger de nouvelles règles :

```powershell
npm run build:ubl
npm run build
```

Le script vérifie les empreintes des sources avant compilation. Il ne met pas à jour les normes automatiquement. Les licences et avis des composants tiers sont conservés dans public/ubl/licenses.

Références : [OASIS UBL 2.1](https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html), [artefacts EN16931 1.3.17](https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/tag/validation-1.3.17), [Peppol BIS Billing 3.0](https://docs.peppol.eu/poacc/billing/3.0/), [formats et API françaises](https://www.impots.gouv.fr/specifications-externes-b2b).

## Certification et originaux

Un XML valide ne certifie pas son origine. L’adaptateur n’utilise pas une éventuelle signature XML incorporée comme preuve d’authenticité : c’est la source approuvée qui signe le relevé Clair.

Les nouveaux formats sont :

- `clair-vat-batch/2` : données normalisées, originaux, masque privé et relevé signé.
- `clair-vat-manifest/2` : relevé public comprenant l’engagement TVA habituel, un engagement des documents originaux et les versions de validation utilisées.

La création et l’import de lots pour de nouvelles preuves utilisent uniquement la version 2 avec ses originaux UBL. La vérification des preuves existantes reste compatible avec les relevés version 1. Le programme Noir et le format de preuve `clair-proof/vat-1` restent inchangés : l’enveloppe peut porter un relevé version 1 ou 2.

Chaque document conserve ses octets en base64 et son empreinte SHA-256. Son identifiant interne est dérivé du fournisseur, du numéro UBL original et du type de pièce, afin de gérer les identifiants Unicode sans perdre la référence au document source.

L’engagement des documents est un SHA-256 sur un tableau JSON versionné comprenant le masque privé, l’entreprise, la période et la liste ordonnée des identifiants internes, types, numéros originaux, empreintes des fichiers et profils. Le masque empêche de reconnaître trivialement un lot à partir de son seul engagement public. Le nom local du fichier est une information de présentation et ne modifie pas cet engagement.

La signature P-256 du relevé version 2 lie cet engagement des originaux à l’engagement des données normalisées utilisé par Noir. Le circuit prouve les calculs sur ces données normalisées ; l’autorité atteste leur correspondance aux originaux. Le XML n’est pas analysé dans le circuit.

Les XML, numéros de facture et masque ne sont jamais ajoutés au fichier de preuve public. Le vérificateur contrôle la signature du relevé et les paramètres prouvés ; l’administration peut demander les originaux et le lot privé pour un contrôle complémentaire.

L’exhaustivité reste une attestation de l’autorité pour l’entreprise et la période clôturée. Sélectionner des fichiers UBL ne prouve pas qu’aucune facture n’a été omise avant la certification. Une connexion à la plateforme et un processus de clôture fiable restent à intégrer pour automatiser cette attestation.

## Composants tiers

- libxml2-wasm 0.7.2 et libxml2 : licences MIT, avis embarqués.
- saxes 6.0.0 : licence ISC, et xmlchars 2.2.0 : licence MIT, pour la lecture bornée avant le DOM. Avis originaux embarqués.
- SaxonJS / xslt3 2.7 : Saxonica, redistribution du moteur navigateur sans modification selon sa licence incluse.
- Artefacts EN16931 : EUPL 1.2, sources et avis conservés.
- Artefacts Peppol : source officielle avec son avis CEN, version et provenance conservées.
- Compilateur ISO Schematron Skeleton : licence MIT intégrée dans ses fichiers sources.
