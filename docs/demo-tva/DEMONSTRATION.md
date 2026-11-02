# Démonstration TVA reproductible

## Préparer et lancer

Depuis la racine du dépôt, avec les dépendances et Chromium Playwright installés :

    npm run demo:tva

Le script construit Clair puis effectue trois passages pour chaque volume : 10, 100 et 500 documents. Il utilise le vrai navigateur, les validateurs embarqués, la vraie signature P-256 et Noir / UltraHonk. Il vérifie chaque preuve dans un nouveau contexte sans compte. Le serveur reçoit une configuration locale explicite : il n’utilise ni les clés Stripe ni la base configurée dans le .env, et ne réalise aucun paiement.

Pour un essai court :

    npm run demo:tva -- --counts=10 --runs=1

Si Chromium manque : `npx playwright install chromium`. Une connexion peut être nécessaire pour les paramètres cryptographiques publics. Préparer le poste avant le rendez-vous.

Chaque exécution crée un dossier distinct dans **data/demo-tva/** et une archive ZIP du même nom. Les fichiers générés restent exclus de Git. Le pointeur **data/demo-tva/latest.json** indique le dernier kit terminé avec succès. Une préparation interrompue ou échouée ne remplace pas ce pointeur. Le chemin du dossier est affiché, sans clés ni mots de passe dans le journal.

    npm run demo:tva:serve

Cette commande sert le dernier kit sur **http://localhost:3002**, avec une base fictive en mémoire. Les comptes de démonstration et leurs mots de passe figurent dans le README local du kit. L’utilisateur entreprise dispose d’un abonnement synthétique ; il n’y a aucun paiement. Un compte administrateur séparé permet de gérer la source fictive. Lancer Ctrl+C pour arrêter ; un redémarrage réinitialise cette base.

Sous Windows, **demo-tva.cmd preparer** prépare et mesure ; **demo-tva.cmd** lance le serveur du dernier kit. Le serveur habituel sur le port 3000 et le terminal Stripe ne sont pas arrêtés. Si le port 3002 est occupé, libérer ce port sans arrêter un service inconnu.

## Les fichiers livrés

- **source/** : clé publique et clé privée de démonstration, au format .clair. Cette clé privée est volontairement fournie pour reproduire l’exercice ; ce n’est pas une source réelle.
- **lots/10, lots/100, lots/500** : XML fictifs, lot certifié privé, preuve publique, rapport PDF public, référence indépendante des totaux et captures de génération/vérification. Les fichiers du dernier passage remplacent ceux du même volume ; les mesures conservent chaque passage.
- **erreurs/** : XML invalides ou hors période, lot incomplet, signature altérée, preuve altérée, captures et constats réellement observés.
- **mesures.json / mesures.csv / RESULTATS.md** : mesures brutes, configuration et synthèse ; un état `failed` reste visible si une exécution ne termine pas.
- **README.md** : connexion et scénario manuel.

Le ZIP contient les clés et identifiants fictifs pour la reproductibilité. Ne jamais y ajouter de données client réelles ni approuver la clé de démonstration dans un registre de production.

## Présentation au client — environ 15 minutes à adapter

1. Présenter le problème et les données publiques/privées avec [la fiche client](FICHE-CLIENT.md).
2. Sur le serveur de démonstration, utiliser le compte entreprise. Choisir **TVA collectée**, puis importer **lots/10/xml**, du **01/09/2026 au 30/09/2026**.
3. Montrer les contrôles UBL et les sous-totaux. Expliquer que la sélection manuelle ne démontre pas à elle seule l’exhaustivité.
4. Dans la démonstration seulement, jouer l’émetteur : confirmer le relevé fictif complet, importer la clé privée fictive, signer. En situation réelle, l’émetteur signe sur son infrastructure.
5. Continuer vers la preuve, confirmer le montant, générer et télécharger le fichier public.
6. Ouvrir une fenêtre privée sur la même instance et vérifier la preuve sans compte. Montrer l’entreprise, la période, les totaux, le nombre de pièces et la source. Dans « Vérifier une règle précise (avancé) », comparer l’empreinte attendue du fichier REFERENCE.md du lot. Ne pas partager le lot certifié, qui contient les factures privées.
7. Rejouer deux erreurs parmi les cas ci-dessous. Montrer les résultats mesurés pour les trois volumes plutôt que lancer tous les calculs pendant le rendez-vous.
8. Conclure par le [cadrage de pilote](PILOTE.md) : logiciel, inventaire de référence, destinataire et critères de réussite.

Les pièces et la source sont fictives, les signatures et preuves sont réelles. La source est préapprouvée uniquement dans le registre isolé de cette démonstration. Les relevés expirent après 90 jours : préparer un nouveau kit avant une démonstration ultérieure.

## Erreurs volontaires et explications

| Cas                             | Action à montrer                                                                              | Résultat attendu et signification                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| XML au total incohérent         | Importer erreurs/01-total-incoherent.xml                                                      | Rejet par les règles embarquées : le montant à payer ne correspond pas aux autres totaux                   |
| Pièce hors période              | Importer erreurs/02-hors-periode.xml pour septembre                                           | Rejet du rattachement au lot, indépendamment du calcul ZK                                                  |
| Facture retirée du lot certifié | Importer erreurs/lot-incomplet.lot-tva.clair                                                  | Rejet : le lot ne correspond plus au nombre de pièces certifié                                             |
| Signature altérée               | Importer erreurs/signature-alteree.lot-tva.clair                                              | Rejet de provenance ; aucune preuve de ce lot ne doit être produite                                        |
| Mauvais montant annoncé         | Charger le lot conforme, remplacer le montant par 0,01                                        | Refus de génération : le montant ne correspond pas au solde calculé                                        |
| Preuve altérée                  | Vérifier erreurs/preuve-alteree.preuve.clair                                                  | Rejet cryptographique d’une preuve dont les octets ont été changés                                         |
| Source révoquée                 | Depuis le compte administrateur fictif, révoquer demo-tva, puis revérifier la preuve conforme | Le calcul ZK reste valide mais la provenance n’est plus approuvée ; réapprouver la source après l’exercice |

Ces contrôles n’ont pas tous lieu dans le circuit : le XML est validé à l’import, l’autorité lie les originaux au relevé et le circuit contrôle les données normalisées, leurs engagements, dates et calculs. Cette distinction doit rester explicite pendant la présentation.

## Mesures et limites

Voir [les mesures réalisées le 02/11/2026](MESURES-2026-11-02.md) et le RESULTATS.md du kit. Les mesures suivent les étapes réellement affichées dans l’interface ; la génération complète inclut notamment la compilation publique et la vérification locale. Les répétitions partagent le cache du serveur, sans redémarrage à froid du poste. La mémoire maximale du navigateur/WASM n’est pas mesurée.

Un gain de temps pour une administration n’est pas déduit de ces seuls chronométrages : il faut comparer le contrôle métier habituel et le nouveau parcours dans un pilote.
