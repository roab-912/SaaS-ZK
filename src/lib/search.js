function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr-FR');
}
export function matchesSearch(query, ...values) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const text = values.map(normalize).join(' ');
  return terms.every((term) => text.includes(term));
}
