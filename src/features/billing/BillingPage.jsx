import { CopyButton } from '../../components/CopyButton.jsx';
import React, { useState, useEffect } from 'react';
import { ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { billingPath } from './billing-model.js';
import { date } from '../../lib/format.js';
export function Billing({
  session,
  refresh,
  notify,
  login,
  onOpen = (action, plan) => location.assign(billingPath(action, plan)),
}) {
  const [busy, setBusy] = useState(false);
  const { user, billingMode: mode, paymentEnvironment, usage } = session;
  const hasExisting = Boolean(
    user?.active ||
    (user?.status && !['inactive', 'canceled', 'incomplete_expired'].includes(user.status)),
  );
  const [loadedPlans, setLoadedPlans] = useState(null),
    [priceError, setPriceError] = useState(''),
    [priceAttempt, setPriceAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setPriceError('');
    setLoadedPlans(null);
    if (mode === 'stripe')
      api('/billing/plans')
        .then((data) => {
          if (!Array.isArray(data)) throw Error('Catalogue invalide.');
          if (mounted) setLoadedPlans(data);
        })
        .catch((e) => {
          if (mounted) setPriceError(e.message);
        });
    return () => {
      mounted = false;
    };
  }, [mode, priceAttempt]);
  const plans = loadedPlans ||
    session.plans || [
      {
        id: 'essential',
        name: 'Clair Essentiel',
        circuits: 10,
        proofs: 100,
        generations: 100,
        available: true,
      },
    ];
  const run = async (action, plan = user?.plan || 'essential') => {
    if (!user) return login();
    if (action !== 'sync') return onOpen(action, plan);
    setBusy(true);
    try {
      await api('/billing/sync', {});
      await refresh();
      notify('Abonnement mis à jour.');
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Votre abonnement"
        desc="Choisissez les limites adaptées à votre utilisation."
      />
      {priceError && (
        <div className="catalog-error" role="alert">
          <p className="error-text">Les tarifs n’ont pas pu être chargés. {priceError}</p>
          <Button variant="secondary small" onClick={() => setPriceAttempt((n) => n + 1)}>
            Réessayer
          </Button>
        </div>
      )}
      {mode === 'demo' && (
        <p className="notice">
          Stripe n’est pas configuré. Le compte reste inactif jusqu’à la souscription d’un
          abonnement.
        </p>
      )}
      {user?.trialActive && (
        <p className="notice" role="status">
          Votre essai Stripe est actif jusqu’au {date(user.expires)}. Vous pouvez gérer son
          renouvellement et l’annuler depuis Clair.
        </p>
      )}
      <div className="billing-layout">
        <div className="plans-list">
          {[...plans]
            .sort((a, b) =>
              user?.active
                ? Number(b.id === (user.plan || 'essential')) -
                  Number(a.id === (user.plan || 'essential'))
                : 0,
            )
            .map((plan) => {
              const current = user?.active && (user.plan || 'essential') === plan.id;
              return (
                <section className={'plan-card' + (current ? ' current-plan' : '')} key={plan.id}>
                  <div className="template-top">
                    <span className="template-icon sage">
                      <Sparkles size={23} />
                    </span>
                    <Badge tone="green">
                      {current
                        ? user?.trialActive
                          ? 'Essai en cours'
                          : 'Votre offre'
                        : paymentEnvironment === 'demo'
                          ? 'Démonstration locale'
                          : paymentEnvironment === 'test'
                            ? 'Stripe · Mode test'
                            : 'Stripe · Paiement réel'}
                    </Badge>
                  </div>
                  <h2>{plan.name}</h2>
                  <div className="price">
                    {plan.price
                      ? new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: plan.price.currency,
                        }).format(
                          plan.price.amount /
                            10 **
                              new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: plan.price.currency,
                              }).resolvedOptions().maximumFractionDigits,
                        )
                      : mode === 'demo'
                        ? 'Tarif à configurer'
                        : loadedPlans || priceError
                          ? 'Tarif indisponible'
                          : 'Chargement du tarif…'}
                    {plan.price && (
                      <span>
                        {' '}
                        / {plan.price.intervalCount > 1 ? plan.price.intervalCount + ' ' : ''}
                        {
                          { day: 'jour', week: 'semaine', month: 'mois', year: 'an' }[
                            plan.price.interval
                          ]
                        }
                        {plan.price.intervalCount > 1 && plan.price.interval !== 'month' ? 's' : ''}
                        {plan.price.taxBehavior === 'inclusive'
                          ? ' · taxes incluses'
                          : plan.price.taxBehavior === 'exclusive'
                            ? ' · hors taxes'
                            : ''}
                      </span>
                    )}
                  </div>
                  <div className="plan-features">
                    {[
                      plan.circuits + ' circuits enregistrés',
                      plan.generations + ' générations de preuves par mois',
                      plan.proofs + ' preuves archivées',
                      'Calcul sur votre appareil',
                      'Vérification publique et hors ligne',
                    ].map((x) => (
                      <div key={x}>
                        <Check size={17} />
                        {x}
                      </div>
                    ))}
                  </div>
                  {plan.priceError && <p className="error-text">{plan.priceError}</p>}
                  <Button
                    variant="full"
                    disabled={busy || mode !== 'stripe' || !loadedPlans || !plan.available}
                    onClick={() => run(hasExisting ? 'manage' : 'checkout', plan.id)}
                  >
                    {busy && <LoaderCircle className="spin" size={17} />}
                    {mode !== 'stripe'
                      ? 'Configurer Stripe pour souscrire'
                      : priceError
                        ? 'Tarif indisponible'
                        : !loadedPlans
                          ? 'Chargement…'
                          : !plan.available
                            ? 'Bientôt disponible'
                            : hasExisting
                              ? current
                                ? 'Gérer mon abonnement'
                                : 'Changer d’offre'
                              : user?.trialEligible === false
                                ? 'Choisir ' + plan.name
                                : 'Essayer ' + plan.name + ' pendant 30 jours'}
                    <ArrowRight size={17} />
                  </Button>
                  <p className="plan-footnote">
                    {mode !== 'stripe'
                      ? 'Aucun accès payant ne sera activé avant la validation dans Stripe.'
                      : hasExisting
                        ? 'Consultez votre facturation, changez d’offre ou gérez le renouvellement de votre abonnement.'
                        : user?.trialEligible === false
                          ? 'Essai déjà utilisé sur ce compte. Le montant sera confirmé avant validation.'
                          : '30 jours d’essai avec un moyen de paiement requis. Un seul essai par compte, toutes offres confondues. Ensuite, facturation automatique sauf annulation.'}
                    {paymentEnvironment === 'test' &&
                      ' Paiements Stripe de test : aucun prélèvement réel.'}
                  </p>
                </section>
              );
            })}
        </div>
        <section className="panel explanation">
          <h2>Votre compte</h2>
          <div className="public-row">
            <span>Adresse</span>
            <strong>{user?.email || 'Non connecté'}</strong>
          </div>
          {user && (
            <div className="public-row">
              <span>Identifiant du compte</span>
              <span className="hash-with-copy">
                <strong className="account-id">{user.id}</strong>
                <CopyButton value={user.id} label="Copier l’identifiant du compte" />
              </span>
            </div>
          )}
          <div className="public-row">
            <span>Abonnement</span>
            <Badge tone={user?.active ? 'green' : ''}>
              {user?.trialActive ? 'Essai gratuit' : user?.active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
          {user?.active && (
            <div className="public-row">
              <span>Accès jusqu’au</span>
              <strong>{date(user.expires)}</strong>
            </div>
          )}
          {usage && (
            <>
              <h3>Votre consommation · {usage.limits.name}</h3>
              {[
                ['Circuits enregistrés', 'circuits'],
                ['Preuves archivées', 'proofs'],
                ['Générations ce mois-ci', 'generations'],
              ].map(([label, key]) => (
                <div className="quota-row" key={key}>
                  <div className="public-row">
                    <span>{label}</span>
                    <strong>
                      {usage[key]} / {usage.limits[key]}
                    </strong>
                  </div>
                  <progress aria-label={label} value={usage[key]} max={usage.limits[key]} />
                </div>
              ))}
              <p className="help">
                Remise à zéro des générations le {date(usage.resets, { timeZone: 'UTC' })} (mois
                civil UTC). {usage.pending || 0} génération(s) en cours.
              </p>
            </>
          )}
          <div className="notice">
            Vos archives restent consultables après expiration. Supprimer une archive libère une
            place ; le compteur mensuel des générations terminées reste inchangé. Les calculs
            échoués ou annulés ne consomment pas le quota mensuel.
          </div>
          {mode === 'stripe' && (
            <>
              <p>
                Carte bancaire, Apple Pay et Google Pay directement dans Clair, selon les moyens
                disponibles sur votre appareil. Les données bancaires sont gérées par Stripe.
              </p>
              {user && (
                <div className="row-actions">
                  <Button variant="secondary" disabled={busy} onClick={() => run('manage')}>
                    Gérer la facturation
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => run('sync')}>
                    Actualiser le statut
                  </Button>
                </div>
              )}
            </>
          )}
          <h3>Vérifier reste ouvert à tous.</h3>
          <p>Le destinataire d’une preuve peut la vérifier sans souscrire à Clair.</p>
          {user && (
            <details className="journey-details">
              <summary>Sécurité du compte</summary>
              <p className="help">Fermez toutes vos sessions, y compris sur cet appareil.</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api('/auth/logout-all', {});
                    location.assign('/connexion');
                  } catch (e) {
                    notify(e.message, true);
                    setBusy(false);
                  }
                }}
              >
                Se déconnecter de tous les appareils
              </Button>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
