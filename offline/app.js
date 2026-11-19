import { showInvoice } from './invoice-view.js';
import {
  VAT_DOCUMENT_LIMITS,
  base64Bytes,
  verifyOriginalsAgainstManifest,
} from '../shared/vat-originals.mjs';
const element = (id) => document.getElementById(id),
  file = element('proof'),
  button = element('verify');
let snapshot, acceptedManifest;
let originalDocuments;
let revision = 0;
let auditRevision = 0;
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
      const option = document.createElement('option');
      option.value = i.id;
      option.textContent = i.name + ' · ' + i.id;
      element('issuer').append(option);
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
function clearResult() {
  revision++;
  clearOriginals();
  acceptedManifest = null;
  element('audit').hidden = true;
  element('originals').value = '';
  button.disabled = !file.files[0];
  element('result').hidden = true;
  element('status').textContent = '';
}
file.onchange = clearResult;
for (const id of ['company', 'month', 'issuer', 'expected']) element(id).oninput = clearResult;
element('mode').onchange = () => {
  clearResult();
  element('request').hidden = element('mode').value !== 'vat';
};
button.onclick = async () => {
  clearResult();
  const run = revision;
  button.disabled = true;
  element('result').hidden = true;
  element('status').textContent = 'Reconstruction du circuit et vérification locale…';
  try {
    if (!snapshot) throw Error('Le registre local est indisponible.');
    const isVatRequest = element('mode').value === 'vat';
    const company = element('company').value.trim();
    const month = element('month').value;
    const source = snapshot.issuers.find((i) => i.id === element('issuer').value);
    if (isVatRequest && (!company || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !source))
      throw Error('Renseignez l’entreprise, le mois et la source attendus.');
    const f = file.files[0];
    if (!f || f.size > 300000) throw Error('Choisissez une preuve .clair de 300 Ko maximum.');
    const proof = JSON.parse(await f.text()),
      expected = element('expected').value.trim().toLowerCase();
    if (proof?.format?.startsWith('clair-vat-batch/'))
      throw Error('Vous avez choisi un lot privé. Ouvrez le fichier de preuve pour ce contrôle.');
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
    if (run !== revision) return;
    if (!response.ok) throw Error(r.error);
    if (isVatRequest) {
      if (!r.valid || !r.result)
        throw Error('Demande refusée. Preuve invalide ou source non approuvée.');
      const manifest = r.vatManifest;
      if (r.vatProgramVersion !== 2 || manifest?.format !== 'clair-vat-manifest/2')
        throw Error('Demande refusée. Le programme TVA v2 avec originaux est requis.');
      if (manifest.companyId !== company)
        throw Error('Preuve valide, entreprise différente de la demande.');
      const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
        .toISOString()
        .slice(0, 10);
      if (manifest.periodStart !== month + '-01' || manifest.periodEnd !== end)
        throw Error('Preuve valide, période différente du mois demandé.');
      if (manifest.issuerId !== source.id || manifest.keyHash !== source.keyHash)
        throw Error('Preuve valide, source différente de celle demandée.');
      acceptedManifest = manifest;
      element('audit').hidden = false;
    }
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
    if (isVatRequest) {
      element('validity').textContent = 'Demande de TVA satisfaite';
      element('condition').textContent =
        company + ' · ' + month + ' · ' + r.vatManifest.count + ' pièces certifiées';
    }
    element('status').textContent = 'Vérification terminée.';
  } catch (error) {
    if (run === revision)
      element('status').textContent =
        error instanceof SyntaxError ? 'Fichier de preuve invalide.' : error.message;
  } finally {
    if (run === revision) button.disabled = !file.files[0];
  }
};
function clearOriginals() {
  auditRevision++;
  originalDocuments = null;
  element('inspection').hidden = true;
  element('document').replaceChildren();
  showDocument();
  element('audit-status').textContent = '';
}
element('close-audit').onclick = clearOriginals;
function showDocument(doc) {
  element('invoice').replaceChildren();
  element('xml-source').open = false;
  element('document-view').hidden = !doc;
  const source = doc ? new TextDecoder().decode(base64Bytes(doc.content)) : '';
  element('xml').textContent = source;
  if (doc) showInvoice(element('invoice'), source);
}
element('document').onchange = () =>
  showDocument(originalDocuments?.[element('document').selectedIndex - 1]);
element('originals').onchange = async () => {
  clearOriginals();
  const run = auditRevision;
  const originals = element('originals').files[0];
  const manifest = acceptedManifest;
  const status = element('audit-status');
  status.textContent = '';
  if (!originals || !manifest) return;
  try {
    if (originals.size > VAT_DOCUMENT_LIMITS.certifiedBytes)
      throw Error('Lot trop volumineux (40 Mo maximum).');
    status.textContent = 'Comparaison des XML au relevé signé…';
    const batch = JSON.parse(await originals.text());
    await verifyOriginalsAgainstManifest(batch, manifest);
    if (run !== auditRevision) return;
    originalDocuments = batch.documents;
    element('document').append(new Option('Choisir une pièce'));
    for (const doc of originalDocuments) element('document').append(new Option(doc.originalId));
    element('inspection').hidden = false;
    status.textContent =
      manifest.count + ' originaux correspondent au relevé de la preuve acceptée.';
  } catch (error) {
    if (run === auditRevision)
      status.textContent =
        'Originaux refusés. ' +
        (error instanceof SyntaxError || error instanceof TypeError
          ? 'Format du lot incorrect.'
          : error.message);
  } finally {
    if (run === auditRevision) element('originals').value = '';
  }
};
