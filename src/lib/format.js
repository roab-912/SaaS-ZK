export const date = (value, options = {}) =>
  new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });

// These helpers change notation only. Domain validation still checks the calendar.
export function displayDate(value) {
  return String(value ?? '').replace(/^(\d{4})-?(\d{2})-?(\d{2})$/, '$3/$2/$1');
}
export function isoDate(value) {
  return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1');
}

export const circuitName = (circuit) => (circuit.vat ? 'TVA collectée' : circuit.name);
