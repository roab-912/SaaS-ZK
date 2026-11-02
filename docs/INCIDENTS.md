# Canevas de gestion d’incident

Version de travail du 02/11/2026. À approuver et exercer avant exposition publique. Aucun dispositif d’astreinte ni canal de notification n’est actuellement configuré par ce dépôt.

## Préparer

Désigner le responsable d’incident, son suppléant, les contacts hébergeur, Stripe, GitHub, émetteurs et personnes à informer. Conserver un canal de contact indépendant du SaaS. Définir les critères d’escalade, les moyens de conserver les preuves et les objectifs de reprise.

## Agir

1. Noter l’heure de détection, les symptômes, la version déployée, le périmètre connu et les incertitudes. Travailler en UTC pour rapprocher les événements.
2. Préserver les journaux et une copie cohérente des éléments utiles avec accès restreint. Ne pas recopier de secrets, factures ou témoins dans une issue publique.
3. Contenir : limiter l’accès réseau si nécessaire, révoquer les sessions concernées, retirer l’approbation d’une clé compromise et contacter son émetteur. Coordonner la rotation des secrets avec leurs propriétaires.
4. Évaluer la confidentialité, l’intégrité, la disponibilité, les utilisateurs concernés et les dépendances. Une preuve valide ne suffit pas à exclure une compromission du signataire.
5. Faire déterminer les obligations de signalement et les destinataires selon le périmètre réglementaire et les contrats réellement applicables ; conserver décisions et horaires. Le SaaS ne notifie aucune autorité automatiquement.
6. Corriger, tester en environnement isolé, restaurer depuis une sauvegarde vérifiée si nécessaire, puis faire approuver la remise en service.
7. Surveiller la reprise et réaliser un retour d’expérience avec responsables, échéances et preuves des actions terminées.

## Traces disponibles dans Clair

Les événements applicatifs couvrent inscription, connexion, échec de connexion, déconnexion, révocation des sessions, modification d’une autorité et opérations de facturation. Ils contiennent des identifiants techniques et l’heure ; ils doivent rester protégés. Ils ne contiennent ni mots de passe, e-mails, clés privées, témoins ZK ou secrets Stripe.

Les logs actuels n’offrent pas à eux seuls de stockage distant, d’inaltérabilité, de rétention garantie ou d’alertes. Prévoir une collecte hors de la machine applicative, des accès nominatifs et une rétention proportionnée à la politique approuvée. En cas de compromission de la machine, ne pas supposer ses logs locaux complets ou fiables.

## Exercice de validation

Sur des comptes et une base de test : simuler une session volée, révoquer tous les appareils et vérifier leur rejet ; révoquer une autorité et vérifier le retrait de confiance ; restaurer une sauvegarde dans une instance isolée ; vérifier la disponibilité des contacts et la chronologie de décision. Conserver un compte rendu. Cet exercice organisationnel n’a pas été réalisé par l’audit de code.

Références : [ANSSI — NIS2](https://messervices.cyber.gouv.fr/nis2), [directive (UE) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj).
