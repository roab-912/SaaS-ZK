import React, { useMemo, useRef, useState } from 'react';
import {
  CheckoutElementsProvider,
  PaymentElement,
  ExpressCheckoutElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { money } from './billing-model.js';
import { Button } from '../../components/ui.jsx';
import { paymentStripe, stripeAppearance } from '../../lib/stripe-client.js';

class CheckoutBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="validation invalid" role="alert">
        Le formulaire sécurisé est indisponible. Rechargez la page pour réessayer.
      </p>
    ) : (
      this.props.children
    );
  }
}
function CheckoutForm({ sessionId, trialDays, mode, onComplete }) {
  const state = useCheckoutElements();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submitted = useRef(false);
  if (state.type === 'loading') return <p role="status">Chargement du formulaire sécurisé…</p>;
  if (state.type === 'error')
    return (
      <p className="validation invalid" role="alert">
        Le formulaire de paiement n’a pas pu être chargé. Réessayez en rechargeant cette page.
      </p>
    );
  async function confirm(event) {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await state.checkout.confirm({
        redirect: 'if_required',
        ...(event ? { expressCheckoutConfirmEvent: event } : {}),
      });
      if (result.type === 'error') {
        setError(result.error.message || 'Le paiement n’a pas pu être confirmé.');
        return;
      }
      await onComplete(result.session.id || sessionId);
    } catch (e) {
      setError(e.message || 'La confirmation est indisponible. Réessayez.');
    } finally {
      submitted.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
      className="payment-form"
    >
      <ExpressCheckoutElement
        options={{
          paymentMethods: {
            applePay: 'auto',
            googlePay: 'auto',
            link: 'never',
            paypal: 'never',
            amazonPay: 'never',
            klarna: 'never',
          },
        }}
        onConfirm={confirm}
      />
      {mode !== 'setup' && (
        <p className="payment-total">
          À régler aujourd’hui :{' '}
          <strong>
            {money(state.checkout.total.total.minorUnitsAmount, state.checkout.currency)}
          </strong>
        </p>
      )}
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
        }}
      />
      {error && (
        <p className="validation invalid" role="alert">
          {error}
        </p>
      )}
      <Button variant="full" disabled={busy || !state.checkout.canConfirm}>
        {busy
          ? 'Confirmation en cours…'
          : mode === 'setup'
            ? 'Enregistrer ce moyen de paiement'
            : trialDays
              ? 'Démarrer mes 30 jours d’essai'
              : 'Confirmer mon abonnement'}
      </Button>
      <p className="help">
        Vos informations bancaires sont saisies dans le formulaire sécurisé de Stripe. Clair ne les
        reçoit pas. Les portefeuilles compatibles avec votre appareil sont proposés automatiquement.
      </p>
    </form>
  );
}
export function CheckoutPayment({ publishableKey, checkout, onComplete }) {
  const stripe = useMemo(() => paymentStripe(publishableKey), [publishableKey]);
  return (
    <CheckoutBoundary key={checkout.sessionId}>
      <CheckoutElementsProvider
        stripe={stripe}
        options={{
          clientSecret: checkout.clientSecret,
          elementsOptions: { appearance: stripeAppearance },
        }}
      >
        <CheckoutForm
          sessionId={checkout.sessionId}
          trialDays={checkout.trialDays}
          mode={checkout.mode}
          onComplete={onComplete}
        />
      </CheckoutElementsProvider>
    </CheckoutBoundary>
  );
}
