import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { AccountEmpty, Badge, Button, PageHeading } from '../../components/ui.jsx';
import { JourneySteps } from '../../components/JourneySteps.jsx';
import { api } from '../../lib/api.js';
import { date } from '../../lib/format.js';
import { CheckoutPayment } from './CheckoutPayment.jsx';
import { InvoicePayment } from './InvoicePayment.jsx';
import { billingPath, money, recurringPrice } from './billing-model.js';

export function PaymentPage({ session, refresh, login, onExit }) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const path = location.pathname;
  const kind =
    path === '/abonnement/paiement'
      ? 'checkout'
      : path === '/abonnement/moyen-de-paiement'
        ? 'setup'
        : path === '/abonnement/retour'
          ? 'return'
          : 'manage';
  const query = new URLSearchParams(location.search);
  const requested = query.get('offre');
  const [data, setData] = useState(null),
    [checkout, setCheckout] = useState(null),
    [quote, setQuote] = useState(null),
    [selected, setSelected] = useState(requested || session.user?.plan || 'essential'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [done, setDone] = useState(''),
    [renewalAction, setRenewalAction] = useState(null);
  async function reloadState() {
    await api('/billing/sync', {});
    await refresh();
    const current = await api('/billing/state');
    setData((previous) => ({ ...previous, state: current }));
    return current;
  }
  async function completed(sessionId) {
    if (sessionId) {
      const receipt = await api('/billing/complete', { sessionId });
      if (receipt.status !== 'complete')
        throw Error('Le paiement n’est pas confirmé. Vous pouvez reprendre le formulaire.');
    }
    const current = await reloadState();
    setCheckout(null);
    setQuote(null);
    setDone(
      kind === 'setup'
        ? 'Votre moyen de paiement a été mis à jour.'
        : 'Votre demande a été confirmée.',
    );
    return current;
  }
  useEffect(() => {
    let alive = true;
    if (!session.user) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        if (requested && !['essential', 'pro'].includes(requested))
          throw Error('Cette offre n’est pas disponible.');
        const [configuration, plans, state] = await Promise.all([
          api('/billing/config'),
          api('/billing/plans'),
          api('/billing/state'),
        ]);
        if (!alive) return;
        const model = { configuration, plans, state };
        setData(model);
        if (kind === 'checkout' || kind === 'setup') {
          if (!configuration.publishableKey)
            throw Error(
              'Le paiement intégré n’est pas encore configuré. Contactez l’administrateur.',
            );
          const result =
            kind === 'setup'
              ? await api('/billing/payment-method', {})
              : await api('/billing/checkout', { plan: requested || 'essential' });
          if (alive) setCheckout(result);
        } else if (kind === 'return') {
          const sessionId = new URLSearchParams(location.search).get('session_id');
          if (sessionId) {
            const receipt = await api('/billing/complete', { sessionId });
            if (receipt.status !== 'complete')
              throw Error(
                'Le formulaire n’est pas confirmé. Retournez à votre abonnement pour reprendre.',
              );
          }
          await api('/billing/sync', {});
          await refreshRef.current();
          const current = await api('/billing/state');
          if (alive) {
            setData({ ...model, state: current });
            setDone('Votre demande a été traitée. Consultez le statut ci-dessous.');
          }
        } else if (requested && state.subscription?.plan !== requested) {
          const result = await api('/billing/change/preview', { plan: requested });
          if (alive) setQuote(result);
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session.user?.id, kind, requested]);
  async function preview() {
    setBusy(true);
    setError('');
    setDone('');
    try {
      setQuote(await api('/billing/change/preview', { plan: selected }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirmChange() {
    setBusy(true);
    setError('');
    try {
      const result = await api('/billing/change', { plan: quote.plan, token: quote.token });
      await reloadState();
      setQuote(null);
      if (result.pendingPayment)
        setData((p) => ({ ...p, state: { ...p.state, pendingPayment: result.pendingPayment } }));
      setDone(
        result.pendingPayment
          ? 'Votre changement nécessite une confirmation de paiement.'
          : 'Votre offre a été mise à jour.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirmRenewal() {
    setBusy(true);
    setError('');
    try {
      await api('/billing/renewal', { cancel: renewalAction });
      await reloadState();
      setDone(
        renewalAction
          ? 'Le renouvellement est annulé. Vous gardez votre accès jusqu’à la fin de la période.'
          : 'Le renouvellement a été réactivé.',
      );
      setRenewalAction(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const state = data?.state,
    sub = state?.subscription,
    currentPlan = data?.plans.find((p) => p.id === (checkout?.plan || sub?.plan || selected));
  return (
    <>
      <PageHeading
        title={
          kind === 'checkout'
            ? 'Souscrire à Clair'
            : kind === 'setup'
              ? 'Mon moyen de paiement'
              : 'Gérer mon abonnement'
        }
        desc="Votre abonnement et vos paiements se gèrent ici, dans Clair."
        action={
          <Button variant="secondary" onClick={onExit}>
            Retour à mon abonnement
          </Button>
        }
      />
      {session.paymentEnvironment === 'test' && (
        <p className="notice">Paiement de test : aucune somme réelle ne sera prélevée.</p>
      )}
      {!session.user ? (
        <AccountEmpty open={login} />
      ) : loading ? (
        <p role="status">Préparation de votre espace de facturation…</p>
      ) : (
        <>
          {error && (
            <p className="validation invalid" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="validation" role="status">
              {done}
            </p>
          )}
          {checkout && data?.configuration.publishableKey && (
            <>
              <JourneySteps
                steps={['Mon offre', 'Paiement sécurisé', 'Confirmation']}
                current={1}
              />
              <div className="billing-payment-layout">
                <section className="panel form-panel">
                  <h2>
                    {checkout.mode === 'setup' ? 'Enregistrer ma carte' : 'Mon paiement sécurisé'}
                  </h2>
                  <CheckoutPayment
                    publishableKey={data.configuration.publishableKey}
                    checkout={checkout}
                    onComplete={completed}
                  />
                </section>
                <aside className="panel explanation">
                  <CreditCard size={24} />
                  <h2>{checkout.mode === 'setup' ? 'Moyen de paiement' : currentPlan?.name}</h2>
                  {checkout.mode === 'setup' ? (
                    <p>
                      Aucun montant n’est prélevé pour enregistrer votre carte. Elle sera utilisée
                      pour vos prochaines factures.
                    </p>
                  ) : (
                    <>
                      <p className="payment-price">{recurringPrice(currentPlan?.price)}</p>
                      {checkout.trialDays ? (
                        <p>
                          <strong>30 jours d’essai.</strong> Un moyen de paiement est requis.
                          Ensuite, votre abonnement est facturé automatiquement au tarif indiqué,
                          sauf annulation avant la fin de l’essai. Un seul essai par compte.
                        </p>
                      ) : (
                        <p>
                          Votre essai a déjà été utilisé. L’abonnement sera facturé au tarif indiqué
                          à sa confirmation, puis renouvelé automatiquement sauf annulation.
                        </p>
                      )}
                      <p>
                        {currentPlan?.circuits} circuits, {currentPlan?.generations} générations et{' '}
                        {currentPlan?.proofs} preuves archivées.
                      </p>
                    </>
                  )}
                  <p>
                    <ShieldCheck size={16} /> La carte est gérée par Stripe. Vos preuves et
                    informations privées restent séparées du paiement.
                  </p>
                </aside>
              </div>
            </>
          )}
          {state?.pendingPayment && data?.configuration.publishableKey && (
            <section className="panel form-panel">
              <InvoicePayment
                publishableKey={data.configuration.publishableKey}
                payment={state.pendingPayment}
                onComplete={async () => {
                  await reloadState();
                  setDone('Le paiement a été confirmé.');
                }}
              />
            </section>
          )}
          {!checkout && sub && (
            <div className="billing-payment-layout">
              <section className="panel form-panel">
                <h2>Mon abonnement</h2>
                <Badge tone={['active', 'trialing'].includes(sub.status) ? 'green' : ''}>
                  {sub.status === 'trialing'
                    ? 'Essai en cours'
                    : sub.status === 'active'
                      ? 'Actif'
                      : 'Paiement à vérifier'}
                </Badge>
                <div className="public-row">
                  <span>Offre</span>
                  <strong>{data.plans.find((p) => p.id === sub.plan)?.name}</strong>
                </div>
                <div className="public-row">
                  <span>Accès jusqu’au</span>
                  <strong>{sub.expires ? date(sub.expires) : 'En attente de confirmation'}</strong>
                </div>
                {sub.cancelAtPeriodEnd && (
                  <p className="notice">
                    Le renouvellement est annulé. Votre accès prend fin à l’échéance affichée.
                  </p>
                )}
                {state.card && (
                  <p className="help">
                    {state.card.brand} ···· {state.card.last4} · Expire{' '}
                    {String(state.card.expMonth).padStart(2, '0')}/{state.card.expYear}
                  </p>
                )}
                <div className="journey-actions">
                  <a className="button secondary" href={billingPath('payment-method')}>
                    Modifier mon moyen de paiement
                  </a>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setRenewalAction(!sub.cancelAtPeriodEnd)}
                  >
                    {sub.cancelAtPeriodEnd
                      ? 'Réactiver le renouvellement'
                      : 'Annuler le renouvellement'}
                  </Button>
                </div>
                {renewalAction !== null && (
                  <div className="notice spaced">
                    <h3>
                      {renewalAction
                        ? 'Confirmer l’annulation du renouvellement'
                        : 'Confirmer la réactivation'}
                    </h3>
                    <p>
                      {renewalAction
                        ? 'Votre accès reste disponible jusqu’à la fin de la période, puis aucun renouvellement ne sera facturé.'
                        : 'Votre abonnement sera à nouveau renouvelé automatiquement à son échéance, au tarif de votre offre.'}
                    </p>
                    <div className="journey-actions">
                      <Button disabled={busy} onClick={confirmRenewal}>
                        Confirmer
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setRenewalAction(null)}
                      >
                        Revenir
                      </Button>
                    </div>
                  </div>
                )}
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await reloadState();
                      setError('');
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Actualiser le statut
                </Button>
              </section>
              <section className="panel form-panel">
                <h2>Changer d’offre</h2>
                <label>
                  Nouvelle offre
                  <select
                    aria-label="Nouvelle offre"
                    value={selected}
                    disabled={busy}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setQuote(null);
                      setDone('');
                    }}
                  >
                    {data.plans
                      .filter((p) => p.available)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {recurringPrice(p.price)}
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  disabled={
                    busy || selected === sub.plan || sub.cancelAtPeriodEnd || !!state.pendingPayment
                  }
                  onClick={preview}
                >
                  Voir le récapitulatif
                </Button>
                {sub.cancelAtPeriodEnd && (
                  <p className="help">Réactivez le renouvellement pour changer d’offre.</p>
                )}
                {quote && (
                  <div className="journey-summary">
                    <h3>{quote.planName}</h3>
                    <p className="payment-price">{recurringPrice(quote.price)}</p>
                    <p>
                      À régler aujourd’hui :{' '}
                      <strong>{money(quote.amountDueNow, quote.currency)}</strong>.
                    </p>
                    {quote.endsTrial ? (
                      <p className="notice">
                        Ce changement termine immédiatement votre période d’essai et déclenche la
                        facturation de la nouvelle offre.
                      </p>
                    ) : (
                      <p>
                        Changement immédiat, sans prorata.{' '}
                        {quote.renewsAt
                          ? 'Le nouveau tarif sera facturé à partir du ' +
                            date(quote.renewsAt) +
                            '.'
                          : 'Le changement de période de facturation peut déclencher un paiement immédiat, indiqué ci-dessus.'}
                      </p>
                    )}
                    <p className="help">
                      Vos archives sont conservées. Si la nouvelle offre a un plafond inférieur à
                      votre consommation, les nouveaux ajouts seront limités.
                    </p>
                    <Button variant="full" disabled={busy} onClick={confirmChange}>
                      {busy ? 'Mise à jour en cours…' : 'Confirmer le changement d’offre'}
                    </Button>
                  </div>
                )}
              </section>
            </div>
          )}
          {!checkout && !sub && !loading && !error && (
            <section className="panel explanation">
              <h2>Votre abonnement n’est pas encore actif</h2>
              <p>Choisissez une offre depuis Mon abonnement pour commencer.</p>
              <Button onClick={onExit}>Voir les offres</Button>
            </section>
          )}
        </>
      )}
    </>
  );
}
export default PaymentPage;
