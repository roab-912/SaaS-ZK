import React, { useEffect, useState } from 'react';
import { Users, CreditCard, GitBranch, FileCheck2 } from 'lucide-react';
import { PageHeading, Stat, Button } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
export function AdminDashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError('');
    try {
      setData(await api('/admin/dashboard'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <PageHeading
        title="Administration"
        desc="Activité des comptes et des abonnements."
        action={
          <Button disabled={busy} onClick={load}>
            Actualiser
          </Button>
        }
      />
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Chargement des statistiques…</p>}
      {data && (
        <>
          <p className="notice">
            {data.paymentEnvironment === 'demo'
              ? 'Démonstration locale : aucun paiement.'
              : data.paymentEnvironment === 'test'
                ? 'Stripe en mode test : aucun paiement réel.'
                : 'Stripe en mode réel.'}{' '}
            Ces compteurs représentent les droits d’accès ; ils ne constituent pas un relevé
            comptable.
          </p>
          <section className="stats admin-stats">
            <Stat icon={Users} label="Utilisateurs" value={data.users} sub="Comptes inscrits" />
            <Stat
              icon={CreditCard}
              label="Abonnements actifs"
              value={data.activeSubscriptions}
              sub="Actifs ou en période d’essai, non expirés"
            />
            <Stat
              icon={GitBranch}
              label="Circuits enregistrés"
              value={data.circuits}
              sub="Tous les comptes"
            />
            <Stat
              icon={FileCheck2}
              label="Preuves archivées"
              value={data.proofs}
              sub="Tous les comptes"
            />
          </section>
          <section className="panel explanation">
            <h2>Répartition des abonnements actifs</h2>
            {data.plans.map((plan) => (
              <div className="public-row" key={plan.id}>
                <span>{plan.name}</span>
                <strong>{data.subscriptions.find((s) => s.plan === plan.id)?.count || 0}</strong>
              </div>
            ))}
            <div className="public-row">
              <span>Générations terminées · {data.period} (UTC)</span>
              <strong>{data.generations}</strong>
            </div>
            <h3>Statuts des comptes</h3>
            {data.statuses.map((s) => (
              <div className="public-row" key={s.status}>
                <span>
                  {{
                    inactive: 'Sans abonnement',
                    active: 'Actif',
                    trialing: 'Essai en cours',
                    past_due: 'Paiement en retard',
                    canceled: 'Résilié',
                    unpaid: 'Impayé',
                    incomplete: 'Souscription à finaliser',
                    incomplete_expired: 'Souscription expirée',
                    paused: 'Suspendu',
                  }[s.status] || s.status}
                </span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
