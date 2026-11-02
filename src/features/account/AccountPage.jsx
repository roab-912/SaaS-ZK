import React from 'react';
import { ArrowRight, CreditCard, FileCheck2, GitBranch, ShieldCheck, Users } from 'lucide-react';
import { AccountEmpty, Badge, Button, PageHeading, Stat } from '../../components/ui.jsx';
import { CopyButton } from '../../components/CopyButton.jsx';
import { date } from '../../lib/format.js';

export function AccountPage({ session, circuits = [], proofs = [], onNavigate }) {
  const { user, usage } = session;
  if (!user)
    return (
      <>
        <PageHeading
          title="Votre espace personnel"
          desc="Retrouvez votre compte, vos circuits et vos preuves au même endroit."
        />
        <section className="panel">
          <AccountEmpty open={() => onNavigate('login')} />
          <div className="account-guest-actions">
            <Button variant="secondary" onClick={() => onNavigate('register')}>
              Créer un compte
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('verify')}>
              Vérifier une preuve sans compte
            </Button>
          </div>
        </section>
      </>
    );
  const plan = usage?.limits?.name ?? session.plans?.find((p) => p.id === user.plan)?.name;
  return (
    <>
      <PageHeading
        title="Votre espace personnel"
        desc="Un aperçu de votre compte et des raccourcis pour continuer."
      />
      <section className="stats" aria-label="Activité de votre espace">
        <Stat
          icon={GitBranch}
          label="Circuits enregistrés"
          value={circuits.length}
          sub="Retrouvez et réutilisez vos règles"
        />
        <Stat
          icon={FileCheck2}
          label="Preuves archivées"
          value={proofs.length}
          sub="Disponibles dans votre espace"
        />
        <Stat
          icon={ShieldCheck}
          label="Générations ce mois-ci"
          value={usage?.generations ?? '—'}
          sub={
            usage?.limits
              ? 'Sur ' + usage.limits.generations + ' générations prévues par l’offre'
              : 'Consommation indisponible'
          }
        />
      </section>
      <div className="account-grid">
        <section className="panel account-panel" aria-labelledby="account-details-title">
          <h2 id="account-details-title">Mon compte</h2>
          <dl className="account-details">
            <div>
              <dt>Adresse e-mail</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Identifiant du compte</dt>
              <dd className="hash-with-copy">
                <code className="hash">{user.id}</code>
                <CopyButton value={user.id} label="Copier l’identifiant du compte" />
              </dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>{user.admin ? 'Administrateur' : 'Utilisateur'}</dd>
            </div>
          </dl>
          {user.admin && (
            <Button variant="secondary" onClick={() => onNavigate('admin')}>
              <Users size={16} />
              Ouvrir l’administration
            </Button>
          )}
        </section>
        <section className="panel account-panel" aria-labelledby="account-subscription-title">
          <h2 id="account-subscription-title">Mon abonnement</h2>
          <p className="account-subscription-status">
            <Badge tone={user.active ? 'green' : ''}>
              {user.trialActive
                ? 'Essai en cours'
                : user.active
                  ? 'Actif'
                  : 'Sans abonnement actif'}
            </Badge>
          </p>
          {user.active && plan && <p>{plan}</p>}
          {user.active && user.expires && (
            <p className="help">
              {user.trialActive ? 'Fin de l’essai le ' : 'Accès jusqu’au '}
              {date(user.expires)}.
            </p>
          )}
          {!user.active && (
            <p className="help">
              Un abonnement actif est nécessaire pour créer des circuits et générer des preuves. Vos
              archives et la vérification restent accessibles.
            </p>
          )}
          <Button variant="secondary" onClick={() => onNavigate('billing')}>
            <CreditCard size={16} />
            {user.active ? 'Gérer mon abonnement' : 'Choisir un abonnement'}
          </Button>
        </section>
      </div>
      {usage?.limits && (
        <section className="panel account-panel" aria-labelledby="account-usage-title">
          <h2 id="account-usage-title">Ma consommation</h2>
          <div className="account-usage">
            {[
              ['Circuits enregistrés', 'circuits'],
              ['Preuves archivées', 'proofs'],
              ['Générations ce mois-ci', 'generations'],
            ].map(([label, key]) => (
              <div key={key}>
                <label>
                  {label}
                  <span>
                    {usage[key]} / {usage.limits[key]}
                  </span>
                  <progress aria-label={label} value={usage[key]} max={usage.limits[key]} />
                </label>
              </div>
            ))}
          </div>
          {usage.resets && (
            <p className="help">
              Les générations sont remises à zéro le {date(usage.resets, { timeZone: 'UTC' })} (mois
              civil UTC).{usage.pending > 0 ? ' ' + usage.pending + ' génération(s) en cours.' : ''}
            </p>
          )}
        </section>
      )}
      <section className="panel account-panel" aria-labelledby="account-shortcuts-title">
        <h2 id="account-shortcuts-title">Que souhaitez-vous faire ?</h2>
        <div className="journey-actions">
          <Button onClick={() => onNavigate('circuits')}>
            <GitBranch size={16} />
            Ouvrir mes circuits
            <ArrowRight size={16} />
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('proofs')}>
            <FileCheck2 size={16} />
            Ouvrir mes preuves
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('verify')}>
            <ShieldCheck size={16} />
            Vérifier une preuve
          </Button>
        </div>
        <p className="help">
          Besoin d’aide ?{' '}
          <button className="text-link dark" onClick={() => onNavigate('guide')}>
            Consulter le guide
          </button>
        </p>
      </section>
    </>
  );
}
