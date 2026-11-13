# Parcours utilisateur

L’interface privilégie les objectifs : prouver une majorité, un revenu ou un montant de TVA. Un circuit est expliqué comme une règle et une attestation comme une information signée.

- Proposer un modèle prêt à utiliser avant l’éditeur personnalisé.
- Afficher l’étape courante et une action principale explicite. Une étape future ne doit pas permettre de contourner les contrôles.
- Privilégier les fichiers aux champs JSON ou JWK. Les réglages de moteurs et les empreintes restent accessibles dans les options avancées.
- Expliquer ce qui restera privé, ce qui sera public et qui doit signer. Une personne utilisant une attestation n’a pas besoin de la clé privée de l’émetteur.
- Donner un récapitulatif avant signature ou preuve : entreprise, dates, nombre de factures et montant.
- Afficher une erreur qui indique la cause et l’action attendue. Refuser les XML non conformes, sans correction implicite.
- Distinguer validité de la preuve, résultat vrai ou faux, et approbation de la source.
- Fournir les dates en jj/mm/aaaa et conserver des parcours utilisables au clavier et sur mobile.

Le parcours TVA part de « Prouver la TVA collectée », importe les XML, demande la signature à une personne autorisée puis continue vers la preuve sans manipulation de fichier intermédiaire obligatoire. L’import d’un lot signé reçu d’une source reste disponible. Le téléchargement de ce lot privé sert à l’archivage ou à une remise à l’entreprise ; seul le fichier de preuve est destiné au vérificateur.

Le guide propose des accès directs aux modèles et à la vérification, ainsi qu’un glossaire. Les pages d’abonnement et de connexion conservent leurs accès et leurs conditions ; la génération reste soumise aux droits et quotas côté serveur.

## Cohérence de l’interface

- Les pages principales ont une URL conservée au rechargement et dans l’historique. Les brouillons et les données privées restent en mémoire : recharger l’éditeur ou la génération ramène aux circuits.
- Un échec de chargement de l’espace, du registre ou des tarifs affiche une action « Réessayer ». Il ne doit pas être présenté comme une liste vide ou un chargement sans fin.
- L’offre active apparaît en premier dans l’abonnement. Les informations hors ligne et les réglages techniques sont accessibles dans des sections dépliables.
- Les libellés, aides et tableaux restent lisibles sur mobile ; seuls les tableaux larges défilent horizontalement. Les titres de page, le focus clavier et les états actifs accompagnent la navigation.
- Une preuve chargée affiche son nom. Les attestations privées et publiques sont distinguées des données déclarées, sans annoncer leur validité avant vérification.
