function fieldName(path) {
  const names = {
    name: 'Nom du circuit',
    description: 'Description',
    engine: 'Moteur de preuve',
    version: 'Mode de résultat',
    label: 'Libellé',
    type: 'Type',
    visibility: 'Visibilité',
    source: 'Source',
    attestation: 'Attestation attendue',
    claim: 'Champ signé',
    issuerId: 'Émetteur',
    keyHash: 'Empreinte de clé',
    id: 'Identifiant',
    values: 'Liste de valeurs',
    value: 'Valeur',
    op: 'Opérateur',
    kind: 'Type de bloc',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    result: 'Résultat public',
    publicData: 'Valeurs publiques lisibles',
    publicInputs: 'Paramètres publics',
    proof: 'Preuve',
    format: 'Format de preuve',
  };
  if (path[0] === 'inputs' && Number.isInteger(path[1]))
    return 'Entrée ' + (path[1] + 1) + (names[path[2]] ? ' — ' + names[path[2]] : '');
  if (path[0] === 'root') {
    let location = 'Bloc principal';
    for (let n = 1; n < path.length; n++)
      if (path[n] === 'args' && Number.isInteger(path[n + 1]))
        location += ' → branche ' + (path[++n] === 0 ? 'A' : 'B');
    return location + (names[path.at(-1)] ? ' — ' + names[path.at(-1)] : '');
  }
  return names[path[0]] || 'Données';
}
export function validationMessage(error) {
  if (!Array.isArray(error?.issues)) return error?.message || 'Vérifiez les champs du formulaire.';
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const field = fieldName(issue.path ?? []);
      if (issue.code === 'unrecognized_keys')
        return (
          field +
          ' : ce format contient des champs non pris en charge. Rechargez la page et vérifiez que le serveur est à jour.'
        );
      if (issue.code === 'invalid_enum_value')
        return field + ' : choisissez une valeur proposée dans la liste.';
      if (issue.code === 'invalid_type')
        return (
          field +
          (issue.received === 'undefined' ? ' : champ requis.' : ' : type de valeur incorrect.')
        );
      if (issue.code === 'too_small')
        return (
          field +
          (issue.type === 'string' && issue.minimum === 1
            ? ' : ce champ ne peut pas être vide.'
            : ' : minimum ' +
              issue.minimum +
              (issue.type === 'string'
                ? ' caractères.'
                : issue.type === 'array'
                  ? ' élément(s).'
                  : '.'))
        );
      if (issue.code === 'too_big')
        return (
          field +
          ' : maximum ' +
          issue.maximum +
          (issue.type === 'string' ? ' caractères.' : issue.type === 'array' ? ' élément(s).' : '.')
        );
      if (issue.code === 'invalid_string') return field + ' : format invalide.';
      return field + ' : valeur invalide.';
    })
    .join(' ');
}
