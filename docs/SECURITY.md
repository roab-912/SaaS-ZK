# Sécurité du MVP

Ces contrôles améliorent la résistance du produit ; ils ne constituent pas un audit indépendant du compilateur ou des bibliothèques cryptographiques.

## Frontières de confiance

L’utilisateur contrôle les circuits et fichiers importés. Le code de l’application, les SDK et les adaptateurs enregistrés sont de confiance. Aucune preuve ne peut déclencher le chargement d’un module distant ni fournir librement son programme de vérification.

La validité d’une preuve sur des données déclarées ne certifie pas leur véracité, leur origine ou leur détenteur. Le registre d’émetteurs ne change pas ce statut : les connecteurs signés restent à implémenter.

## Contrôles appliqués

- Validation stricte des objets et refus des champs additionnels ; limite de taille HTTP, profondeur et nombre de blocs vérifiés avant les schémas récursifs.
- Paramètres publics contrôlés selon leur type : date réelle, booléen 0/1, entier 32 bits. Les formats hexadécimaux/base64 sont bornés.
- Compilation sérialisée, huit travaux distincts en attente au maximum, déduplication, cache de cinquante circuits et copies indépendantes des résultats.
- Hachage scrypt asynchrone avec sels aléatoires et comparaison à temps constant. Les nouveaux hashes utilisent N=32768, r=8, p=3 ; les formats antérieurs sont reconnus puis migrés à la connexion. Ce compromis mémoire/CPU fait partie des configurations de référence [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
- Cookies HttpOnly, SameSite=Strict, Secure en HTTPS ; jetons aléatoires stockés sous forme d’empreinte, rotation à la connexion et expiration côté serveur.
- Protection d’origine sur les mutations ; webhook Stripe exempté uniquement parce que sa signature est vérifiée sur le corps brut.
- Autorisation serveur à chaque opération protégée et filtrage de propriétaire dans toutes les requêtes d’archives.
- Administration par identifiants de comptes autorisés. Les clés P-256 sont parsées cryptographiquement ; clés privées et points invalides sont refusés.
- SQL isolé dans le repository avec paramètres liés.
- Erreurs attendues explicites ; erreurs inattendues retournées en 500 générique avec identifiant. Les journaux ne contiennent ni corps de requête, ni message d’exception susceptible d’inclure un secret. Voir les recommandations [OWASP sur les erreurs](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html).
- Témoin ZK effacé dans un finally après exécution, y compris en cas d’échec de génération/vérification. Le backend est détruit avant de publier un résultat. Les messages du worker ne reprennent pas les diagnostics privés du fournisseur.
- Annulation, erreur, message invalide et dépassement de délai arrêtent le worker et règlent la promesse une seule fois.
- Le mode démonstration exige une origine et une écoute locales ; il est interdit en production. La production exige HTTPS.
- Stripe est relu côté serveur ; les paramètres du navigateur n’activent pas un abonnement. Les synchronisations d’un client sont sérialisées et l’expiration concerne uniquement le prix configuré.

## Exploitation

Garder .env, data/, les exports d’utilisateurs et les journaux hors du dépôt. Utiliser un volume persistant et des sauvegardes SQLite. Configurer le proxy explicitement ; l’application ne fait pas confiance à des en-têtes X-Forwarded-For arbitraires.

Les limites sont en mémoire et conçues pour une instance. Le passage à plusieurs processus demande un stockage partagé pour les sessions, limites et verrous. Le calcul du circuit public n’est pas encore isolé dans un processus système dédié.

Le JavaScript ne permet pas de garantir l’effacement physique de toutes les copies mémoire. Le calcul est local mais charge des paramètres publics depuis crs.aztec.network ; il n’est pas entièrement hors ligne.

Les versions Noir/Barretenberg restent verrouillées ensemble afin de préserver les preuves historiques. Toute mise à jour doit exécuter les tests cryptographiques et de compatibilité. L’absence d’alerte npm audit ne prouve pas l’absence de vulnérabilité.

Restent hors périmètre : audit cryptographique indépendant, récupération de mot de passe, vérification d’e-mail, connecteurs d’attestations, preuve de possession et protection contre la copie.
