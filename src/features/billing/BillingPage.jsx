import React from 'react';
import { useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { date } from '../../lib/format.js';
export function Billing({ session, refresh, notify, login }) {
  const [busy, setBusy] = useState(false);
  const { user, billingMode: mode, paymentEnvironment } = session;
  const run = async (action) => {
    if (!user) return login();
    setBusy(true);
    try {
      const r = await api(
        '/billing/' + action,
        action === 'demo' ? { action: user.active ? 'cancel' : 'activate' } : {},
      );
      if (r.url) location.assign(r.url);
      else {
        await refresh();
        notify('Abonnement mis à jour.');
      }
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
        desc="Un espace personnel pour créer, prouver et partager."
      />
      <div className="billing-layout">
        <section className="plan-card">
          <div className="template-top">
            <span className="template-icon sage">
              <Sparkles size={23} />
            </span>
            <Badge tone="green">
              {paymentEnvironment === 'demo'
                ? 'Démonstration locale'
                : paymentEnvironment === 'test'
                  ? 'Stripe à Mode test'
                  : 'Stripe à Paiement réel'}
            </Badge>
          </div>
          <h2>Clair Essentiel</h2>
          <p>Tout ce qu’il faut pour vos premières preuves.</p>
          <div className="price">
            {mode === 'demo'
              ? '0 ?'
              : paymentEnvironment === 'test'
                ? 'Tarif de test'
                : 'Tarif configuré'}
            <span>{mode === 'demo' ? '/ 30 jours' : 'sur la page de paiement'}</span>
          </div>
          <div className="plan-features">
            {[
              'Création de circuits avec abonnement actif',
              'Éditeur logique à plusieurs niveaux',
              'Génération de preuves sur votre appareil',
              'Enregistrement et téléchargement des preuves',
              'Vérification publique sans abonnement',
            ].map((x) => (
              <div key={x}>
                <Check size={17} />
                {x}
              </div>
            ))}
          </div>
          <Button
            variant="full"
            disabled={busy}
            onClick={() => run(mode === 'demo' ? 'demo' : user?.active ? 'portal' : 'checkout')}
          >
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === 'demo'
              ? user?.active
                ? 'Désactiver l’abonnement de test'
                : 'Activer 30 jours de test'
              : user?.active
                ? 'Gérer mon abonnement'
                : 'Passer au paiement'}
            <ArrowRight size={17} />
          </Button>
          <p className="plan-footnote">
            {mode === 'demo'
              ? 'Aucune carte demandée. Aucun prélèvement.'
              : paymentEnvironment === 'test'
                ? 'Utilisez une carte de test Stripe. Aucun prélèvement réel.'
                : 'Le prix et la périodicité sont confirmés avant paiement.'}
          </p>
        </section>
        <section className="panel explanation">
          <h2>Votre compte</h2>
          <div className="public-row">
            <span>Adresse</span>
            <strong>{user?.email || 'Non connecté'}</strong>
          </div>
          <div className="public-row">
            <span>Abonnement</span>
            <Badge tone={user?.active ? 'green' : ''}>{user?.active ? 'Actif' : 'Inactif'}</Badge>
          </div>
          {user?.active && (
            <div className="public-row">
              <span>Accès jusqu’au</span>
              <strong>{date(user.expires)}</strong>
            </div>
          )}
          <div className="notice">
            Vos circuits et preuves enregistrés restent consultables après expiration. La création
            de circuits et l’enregistrement de nouvelles preuves nécessitent un abonnement actif.
          </div>
          {mode === 'stripe' && user && (
            <div className="row-actions">
              <Button variant="secondary" disabled={busy} onClick={() => run('portal')}>
                Portail de facturation
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => run('sync')}>
                Actualiser le statut
              </Button>
            </div>
          )}
          <h3>Vérifier reste ouvert à tous.</h3>
          <p>Le destinataire d’une preuve peut la vérifier sans souscrire à Clair.</p>
        </section>
      </div>
    </>
  );
}
