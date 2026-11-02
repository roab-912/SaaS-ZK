import { loadStripe } from '@stripe/stripe-js/pure';
const instances = new Map();
export const stripeAppearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#185745',
    colorBackground: '#ffffff',
    colorText: '#253b34',
    colorDanger: '#a33e3e',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    borderRadius: '8px',
    spacingUnit: '4px',
  },
};
export function paymentStripe(key) {
  if (!/^pk_(test|live)_/.test(key || ''))
    return Promise.reject(Error('Le formulaire de paiement n’est pas configuré.'));
  if (globalThis.crossOriginIsolated)
    return Promise.reject(Error('Ouvrez la page de paiement dédiée pour continuer.'));
  if (!instances.has(key))
    instances.set(
      key,
      loadStripe(key, { locale: 'fr' })
        .then((stripe) => {
          if (!stripe) throw Error('Le formulaire de paiement n’a pas pu être chargé.');
          return stripe;
        })
        .catch((e) => {
          instances.delete(key);
          throw e;
        }),
    );
  return instances.get(key);
}

export function themedStripeAppearance(theme) {
  return theme === 'dark'
    ? {
        ...stripeAppearance,
        theme: 'night',
        variables: {
          ...stripeAppearance.variables,
          colorPrimary: '#98cba7',
          colorBackground: '#192720',
          colorText: '#e3eee6',
          colorDanger: '#ffb5b1',
        },
      }
    : stripeAppearance;
}
