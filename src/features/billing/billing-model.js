export function money(amount, currency = 'eur') {
  const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amount / 10 ** digits);
}
export function recurringPrice(price) {
  if (!price) return 'Tarif indisponible';
  const count = price.intervalCount || 1;
  const interval =
    { day: 'jour', week: 'semaine', month: 'mois', year: 'an' }[price.interval] || price.interval;
  return (
    money(price.amount, price.currency) +
    ' / ' +
    (count > 1 ? count + ' ' : '') +
    interval +
    (count > 1 && price.interval !== 'month' ? 's' : '') +
    (price.taxBehavior === 'inclusive'
      ? ' · taxes incluses'
      : price.taxBehavior === 'exclusive'
        ? ' · hors taxes'
        : '')
  );
}
export function billingPath(action, plan) {
  const path =
    action === 'checkout'
      ? '/abonnement/paiement'
      : action === 'payment-method'
        ? '/abonnement/moyen-de-paiement'
        : '/abonnement/gestion';
  return path + (plan && ['essential', 'pro'].includes(plan) ? '?offre=' + plan : '');
}
