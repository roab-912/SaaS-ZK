const element = (id) => document.getElementById(id),
  file = element('proof'),
  button = element('verify');
let snapshot;
const text = (parent, tag, value) => {
  const n = document.createElement(tag);
  n.textContent = value;
  parent.append(n);
};
fetch('/snapshot')
  .then((r) => r.json())
  .then((s) => {
    snapshot = s;
    element('snapshot').textContent =
      'Registre de ' + s.origin + ' exporté le ' + new Date(s.exportedAt).toLocaleString('fr-FR');
    for (const i of s.issuers) {
      text(element('issuers'), 'strong', i.name + ' · ' + i.id);
      text(element('issuers'), 'code', i.keyHash);
    }
    if (!s.issuers.length)
      text(
        element('issuers'),
        'p',
        'Aucune source approuvée incluse. Les preuves déclarées restent vérifiables.',
      );
  })
  .catch(() => {
    element('snapshot').textContent = 'Registre local indisponible.';
  });
file.onchange = () => {
  button.disabled = !file.files[0];
  element('result').hidden = true;
  element('status').textContent = '';
};
button.onclick = async () => {
  button.disabled = true;
  element('result').hidden = true;
  element('status').textContent = 'Reconstruction du circuit et vérification locale…';
  try {
    if (!snapshot) throw Error('Le registre local est indisponible.');
    const f = file.files[0];
    if (!f || f.size > 300000) throw Error('Choisissez une preuve .clair de 300 Ko maximum.');
    const proof = JSON.parse(await f.text()),
      expected = element('expected').value.trim().toLowerCase();
    if (expected && (!/^[a-f0-9]{64}$/.test(expected) || expected !== proof.circuitHash))
      throw Error('L’empreinte du circuit ne correspond pas à celle attendue.');
    const response = await fetch('/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Clair-Local-Token': document.querySelector('meta[name="clair-token"]').content,
      },
      body: JSON.stringify(proof),
    });
    const r = await response.json();
    if (!response.ok) throw Error(r.error);
    element('validity').textContent = r.valid
      ? 'Preuve valide selon le registre téléchargé'
      : 'Preuve invalide ou source non approuvée';
    element('result').className = r.valid ? 'valid' : 'invalid';
    element('condition').textContent = r.valid
      ? 'Résultat prouvé : ' +
        (r.result ? 'Vrai' : 'Faux') +
        ' — une preuve valide ne signifie pas nécessairement que la condition est satisfaite.'
      : 'Le résultat annoncé ne doit pas être considéré comme vérifié.';
    element('name').textContent = r.circuitName;
    element('statement').textContent = r.statement;
    element('hash').textContent = r.circuitHash;
    element('values').replaceChildren();
    for (const i of r.publicData) {
      const value =
        i.type === 'date'
          ? String(i.value).replace(/^(\d{4})-?(\d{2})-?(\d{2})$/, '$3/$2/$1')
          : String(i.value);
      text(element('values'), 'p', i.label + ' : ' + value);
    }
    if (r.vatManifest) {
      text(element('values'), 'p', 'Entreprise : ' + r.vatManifest.companyId);
      const values = Object.fromEntries(r.publicData.map((i) => [i.id, i.value]));
      text(
        element('values'),
        'p',
        'TVA collectée après avoirs : ' +
          ((values.sales_vat - values.credit_vat) / 100).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
          }),
      );
      text(
        element('values'),
        'p',
        'Exhaustivité certifiée par la source pour ce relevé. Rattachement à la date de facture ; prototype hors déclaration fiscale.',
      );
    }
    if (!r.publicData.length) text(element('values'), 'p', 'Aucune valeur d’entrée publique.');
    element('sources').replaceChildren();
    for (const source of r.sources ?? []) {
      text(element('sources'), 'strong', source.issuerName);
      text(
        element('sources'),
        'p',
        source.valid
          ? 'Signature vérifiée · Clé présente dans le registre téléchargé'
          : source.reason,
      );
      text(element('sources'), 'code', source.keyHash);
    }
    if (!r.sources?.length)
      text(element('sources'), 'p', 'Données déclarées : aucune origine certifiée.');
    element('date').textContent =
      'Vérifiée le ' +
      new Date(r.checkedAt).toLocaleString('fr-FR') +
      ' selon l’horloge de cet ordinateur.';
    element('result').hidden = false;
    element('status').textContent = 'Vérification terminée.';
  } catch (error) {
    element('status').textContent =
      error instanceof SyntaxError ? 'Fichier de preuve invalide.' : error.message;
  } finally {
    button.disabled = !file.files[0];
  }
};
