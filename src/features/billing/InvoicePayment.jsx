import React, { useMemo, useRef, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '../../components/ui.jsx';
import { paymentStripe, stripeAppearance } from '../../lib/stripe-client.js';
import { money } from './billing-model.js';

function InvoiceForm({ payment, onComplete }) {
  const stripe = useStripe(),
    elements = useElements();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [newCard, setNewCard] = useState(false);
  const running = useRef(false);
  async function pay(e) {
    e?.preventDefault();
    if (!stripe || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const result = newCard
        ? await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: location.origin + '/abonnement/retour' },
            redirect: 'if_required',
          })
        : await stripe.confirmCardPayment(payment.clientSecret);
      if (result.error) {
        setError(result.error.message || 'Le paiement a été refusé.');
        setNewCard(true);
        return;
      }
      if (result.paymentIntent?.status !== 'succeeded')
        throw Error(
          'Le paiement est en cours de traitement. Actualisez le statut avant de réessayer.',
        );
      await onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="payment-form">
      <h2>Paiement à confirmer</h2>
      <p>
        Montant à régler : <strong>{money(payment.amount, payment.currency)}</strong>. Votre banque
        peut demander une authentification.
      </p>
      <form onSubmit={pay}>
        {newCard && <PaymentElement />}
        {error && (
          <p className="validation invalid" role="alert">
            {error}
          </p>
        )}
        <Button variant="full" disabled={busy || !stripe || (newCard && !elements)}>
          {busy
            ? 'Vérification du paiement…'
            : 'Confirmer le paiement de ' + money(payment.amount, payment.currency)}
        </Button>
        {!newCard && (
          <button
            type="button"
            className="text-link dark"
            disabled={busy}
            onClick={() => setNewCard(true)}
          >
            Utiliser une autre carte
          </button>
        )}
      </form>
    </section>
  );
}
export function InvoicePayment({ publishableKey, payment, onComplete }) {
  const stripe = useMemo(() => paymentStripe(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripe}
      options={{ clientSecret: payment.clientSecret, appearance: stripeAppearance }}
    >
      <InvoiceForm payment={payment} onComplete={onComplete} />
    </Elements>
  );
}
