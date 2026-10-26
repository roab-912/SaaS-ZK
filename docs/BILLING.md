# Comptes, abonnements et paiement

Un nouveau compte est inactif. Il peut consulter ses archives et vérifier des preuves ; la création de circuits, la génération et l’archivage de nouvelles preuves exigent un abonnement actif ou un essai Stripe validé. La déconnexion efface l’espace affiché et redirige vers /connexion.

## Créer les deux offres dans Stripe

1. Dans le Dashboard Stripe, choisir un environnement de test / sandbox. Les produits, tarifs, clés et webhooks doivent tous appartenir au même environnement.
2. Ouvrir **Catalogue de produits**, puis **Ajouter un produit**.
3. Créer **Clair Essentiel** avec une tarification forfaitaire, **récurrente**, en **EUR**, facturée chaque mois. Choisir le montant à facturer après l’essai. Indiquer si le prix inclut les taxes.
4. Faire de même pour **Clair Pro**, avec son propre montant mensuel.
5. Copier l’identifiant du **tarif** de chaque produit : il commence par `price_`. Ne pas utiliser les identifiants `prod_`.
6. Ne pas créer de tarif à 0 € pour l’essai et ne pas ajouter de période d’essai au produit : Clair fournit les 30 jours directement à Stripe Checkout.
7. Dans les paramètres du **portail client**, autoriser l’annulation, la mise à jour des moyens de paiement et le changement entre ces deux tarifs. Enregistrer cette configuration dans le même environnement de test.

Référence : [produits et tarifs Stripe](https://docs.stripe.com/products-prices/manage-prices).

Configuration retenue dans le portail de test : les changements entre Essentiel et Pro sont immédiats, sans prorata. Changer d’offre pendant l’essai termine l’essai et déclenche la facturation du nouveau tarif. Aucun nouvel essai n’est accordé. Pour un abonnement déjà payé, le cycle reste inchangé et le nouveau tarif sera facturé à la prochaine échéance.

## Remplir .env

Remplacer les valeurs fictives ci-dessous par celles du même environnement Stripe de test :

```dotenv
PORT=3000
HOST=127.0.0.1
APP_URL=http://localhost:3000
BILLING_MODE=stripe
STRIPE_SECRET_KEY=sk_test_REMPLACER
STRIPE_PRICE_ESSENTIAL=price_REMPLACER_ESSENTIEL
STRIPE_PRICE_PRO=price_REMPLACER_PRO
STRIPE_WEBHOOK_SECRET=whsec_REMPLACER
ALLOW_LIVE_PAYMENTS=false
```

La clé secrète de test se trouve dans les clés API de Stripe. La renseigner directement dans .env, sans la publier dans le dépôt ni la transmettre dans la conversation. Ce parcours utilise Checkout hébergé : aucune clé publique pk_test n’est nécessaire dans le navigateur.

L’ancienne variable STRIPE_PRICE_ID reste acceptée pour Essentiel si STRIPE_PRICE_ESSENTIAL est vide. Aucun prix fictif n’est inscrit dans l’application : le serveur lit les deux tarifs avec l’API Stripe et met le résultat en cache pendant 60 secondes. Un tarif absent, archivé ou incompatible rend l’offre indisponible. Les modèles pris en charge sont les prix récurrents forfaitaires par unité, sans facturation à l’usage.

## Recevoir les événements en local

Installer [Stripe CLI](https://docs.stripe.com/cli), puis, dans un terminal :

```powershell
stripe login
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Garder ce terminal ouvert. Copier le secret `whsec_...` annoncé par `stripe listen` dans STRIPE_WEBHOOK_SECRET. Ce secret est celui de la session CLI ; il n’est pas nécessairement identique à celui d’un endpoint créé dans le Dashboard.

Relancer ensuite Clair avec demarrer.cmd, puis recharger la page. En local, Stripe ne peut pas joindre directement localhost sans ce relais.

Pour un serveur HTTPS public, créer un endpoint webhook dans Stripe vers `https://votre-domaine/api/billing/webhook` et utiliser son secret. Événements traités : checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed.

## Essai unique, avec moyen de paiement

Les deux offres proposent **30 jours d’essai**, mais **un seul essai au total par compte Clair**. Il commence après validation de Checkout, et non lors de l’inscription. Checkout impose l’enregistrement d’un moyen de paiement, même si le montant initial est nul.

Le serveur relit Stripe après un webhook signé ou une synchronisation : une simple URL de retour ne donne aucun droit. Un essai Stripe sans moyen de paiement reconnu ne donne pas d’accès. La fin de l’essai dépend de trial_end, et non d’une date plus tardive d’un autre article.

Le premier essai observé est mémorisé dans SQLite et l’historique des abonnements Stripe est relu. Une annulation, un changement d’offre ou une réinscription d’abonnement sur le même compte ne réinitialise pas ce droit. Un ancien Checkout ouvert proposant un essai désormais consommé est expiré avant de préparer le nouveau paiement.

À l’issue des 30 jours, Stripe facture automatiquement le tarif choisi, sauf annulation. Sans moyen de paiement à l’échéance, l’abonnement d’essai est annulé par Stripe. En cas d’expiration, de pause ou d’impayé, Clair bloque les nouvelles créations et générations ; les archives et la vérification restent accessibles. Le portail reste disponible pour régulariser la situation.

Les anciens essais locaux ne donnent plus de droits. Leur colonne historique est conservée par la migration, mais n’est plus consultée pour accorder l’accès. L’ancienne route /api/billing/demo a été supprimée.

Référence : [essais dans Stripe Checkout](https://docs.stripe.com/payments/checkout/free-trials).

## Tester

1. Créer un compte Clair : il doit rester inactif et refuser la création d’un circuit.
2. Ouvrir Mon abonnement : vérifier les montants et périodicités configurés dans Stripe.
3. Choisir une offre et terminer Checkout avec la carte de test **4242 4242 4242 4242**, une date future et un CVC à trois chiffres.
4. Vérifier la réception du webhook dans le terminal et l’activation de l’essai. Le bouton Actualiser le statut permet aussi de relire Stripe.
5. Annuler l’abonnement dans le portail, puis tenter l’autre offre sur le même compte : aucun second essai ne doit être accordé.
6. Pour simuler la fin d’un essai, utiliser les fonctions de test Stripe ou terminer l’essai de cet abonnement de test depuis Stripe, puis vérifier les événements. Ne pas modifier les dates de la base Clair pour tester la facturation réelle.

Aucune transaction de production n’est requise. Utiliser exclusivement les clés et cartes de test : [documentation Stripe sur les tests](https://docs.stripe.com/testing).

## Apple Pay et Google Pay

Le paiement est redirigé vers Stripe Checkout. Le moyen card inclut les portefeuilles compatibles ; vérifier leur activation dans les paramètres des moyens de paiement du compte Stripe. Leur visibilité dépend du navigateur, de l’appareil, du portefeuille configuré et des règles Stripe, et n’est donc pas garantie sur chaque écran de test. Aucune intégration native Apple ou Google distincte n’est nécessaire pour ce Checkout hébergé.

Références : [Stripe Checkout](https://stripe.com/payments/checkout), [Apple Pay](https://docs.stripe.com/apple-pay), [Google Pay](https://docs.stripe.com/google-pay).

## Limites et administration

| Offre     | Circuits conservés | Preuves archivées | Générations terminées par mois |
| --------- | -----------------: | ----------------: | -----------------------------: |
| Essentiel |                 10 |               100 |                            100 |
| Pro       |                100 |             1 000 |                          1 000 |

Le catalogue central est server/plans.mjs. Chaque version distincte d’un circuit occupe une place. Les générations suivent le mois civil UTC, indépendamment du cycle de paiement : une réservation de dix minutes est confirmée quand le calcul local réussit. Les échecs libèrent la réservation ; une perte de connexion peut la conserver jusqu’à son expiration. Supprimer une archive libère une place sans rembourser une génération terminée. Une réduction d’offre conserve les anciennes archives mais bloque les ajouts au-delà du plafond.

Ces limites gouvernent le parcours SaaS. Un logiciel ZK local indépendant ne peut pas être bloqué par un compteur serveur ; les confirmations de génération ne transmettent pas les données privées.

Pour devenir administrateur, copier l’identifiant du compte dans Mon abonnement, l’ajouter à ADMIN_USER_IDS puis relancer le serveur. Le tableau de bord contient des agrégats d’utilisateurs, abonnements actifs et essais validés, circuits et preuves ; il ne constitue pas un relevé de revenus encaissés.

## Production

La production exige HTTPS, BILLING_MODE=stripe et des secrets / tarifs / webhooks de production cohérents. ALLOW_LIVE_PAYMENTS=true est un consentement explicite aux paiements réels ; le laisser false pendant tous ces tests. Utiliser un volume SQLite persistant et des sauvegardes. La récupération de mot de passe et la vérification d’adresse e-mail restent à intégrer avant une ouverture commerciale qui en aurait besoin.
