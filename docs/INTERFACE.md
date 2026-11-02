# Interface et accessibilité

Les améliorations visent les parcours du PoC sur ordinateur et sur mobile.

- Apparence : Appareil, Clair ou Sombre dans l’en-tête. Le choix suit aussi les changements du système et des autres onglets. Seul `clair.theme` est conservé dans le stockage local ; si ce stockage est bloqué, le choix fonctionne pour la session.
- Recherche locale : modèles, circuits enregistrés, preuves archivées et sources disponibles. La recherche ignore les accents et la casse, exige tous les mots et peut utiliser une empreinte. Aucun terme n’est envoyé au serveur ni enregistré par cette fonction.
- Clavier : lien « Aller au contenu principal », menu mobile refermable avec Échap, focus conservé dans ce menu, retour au bouton d’ouverture. Les animations respectent la préférence de mouvement réduit.
- Connexion : afficher ou masquer le mot de passe sans soumettre le formulaire. Le changement de parcours remet le champ à zéro.
- Copie : empreintes complètes, clés publiques et identifiant du compte. Succès annoncé ; en cas de refus du presse-papiers, un message indique la copie manuelle. Aucun bouton de copie de clé privée n’est ajouté.
- Actions sensibles : confirmation avant suppression d’un circuit ou d’une preuve et avant révocation ou remplacement de clé d’une source. Annuler est le choix initial au clavier. Une erreur garde la confirmation ouverte.
- Calcul : étapes annoncées avec une progression indéterminée pour les calculs ZK. L’import UBL affiche le nombre réel de documents vérifiés. Les enregistrements sont bloqués pendant leur requête.
- Impression : après vérification, le bouton « Imprimer le rapport public » produit le statut, le résultat, la règle, l’empreinte, les valeurs publiques et la provenance. Le fichier cryptographique brut, les attestations brutes, les champs privés et les clés privées ne sont pas sérialisés dans le rapport. Imprimer une autre page ne produit que des instructions pour ouvrir un rapport.
- Guide : FAQ dépliable, date de révision éditoriale explicite. Les dates de consultation du registre et de vérification sont calculées lors de l’opération ; elles ne prétendent pas dater une modification des données.

Le rapport imprimé facilite la lecture ; la vérification cryptographique reste fondée sur le fichier `.clair`, le circuit attendu et le registre de confiance utilisé. Un résultat faux peut être porté par une preuve valide.

Les fonctionnalités de faible priorité (UTM, contact flottant, retour en haut, en-tête fixe supplémentaire) ne sont pas ajoutées. Aucun suivi publicitaire ni nouveau service tiers n’est installé par ces améliorations. Le besoin d’un bandeau de consentement dépendra des traceurs effectivement déployés.

La page **Espace personnel** (`/espace-personnel`) récapitule le compte connecté, l’abonnement et les compteurs fournis par la session. Elle est accessible depuis le bloc en haut du menu, le fil d’Ariane et « Mon compte » pour les utilisateurs connectés. Les visiteurs peuvent se connecter, créer un compte ou vérifier une preuve gratuitement. Les droits restent appliqués côté serveur ; la page ne modifie pas l’abonnement.

La FAQ dispose de sa propre page `/faq`, accessible par le bouton d’aide « ? » et depuis la page `/comprendre`. « Comprendre le zero knowledge » conserve les explications et propose un schéma interactif : données privées sur l’appareil, règle publique, calcul local, puis vérification par le destinataire. Les exemples fictifs de 24 et 16 ans illustrent un résultat vrai ou faux sans lancer de génération ni envoyer de valeurs au serveur. Les liens croisés et les deux adresses permettent l’accès direct, le rechargement et la navigation arrière.

La FAQ présente les questions dans des cartes dépliables avec des icônes et un état ouvert visible. Les thèmes et la recherche filtrent localement les titres et les réponses, sans requête réseau ni mémorisation. Un état vide permet de réinitialiser les filtres. La navigation par thème et les réponses restent accessibles au clavier, en clair et en sombre, sur ordinateur et mobile.
