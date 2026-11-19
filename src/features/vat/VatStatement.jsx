import React from 'react';
import { Badge } from '../../components/ui.jsx';
import { date, displayDate } from '../../lib/format.js';
import { vatMoney } from '../../../shared/vat.mjs';
export function VatStatement({ manifest, sales, credits, source, proved = false, circuit }) {
  if (!manifest) return null;
  const rows = [
    ['Entreprise', manifest.companyId],
    [
      'Période incluse',
      displayDate(manifest.periodStart) + ' au ' + displayDate(manifest.periodEnd),
    ],
    ['Factures et avoirs', manifest.count],
    ['TVA des ventes', vatMoney(sales)],
    ['TVA des avoirs', vatMoney(credits)],
    ['TVA collectée après avoirs', vatMoney(sales - credits)],
  ];
  return (
    <section className="panel form-panel vat-statement">
      <h2>{proved ? 'TVA prouvée' : 'Relevé de TVA à vérifier'}</h2>
      <Badge tone={proved && source?.valid ? 'green' : ''}>
        {proved && source?.valid
          ? 'Calcul et source vérifiés'
          : source?.valid
            ? 'Signature vérifiée · Calcul à vérifier'
            : 'Relevé signé annoncé · À vérifier'}
      </Badge>
      {rows.map(([label, value]) => (
        <div className="public-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <h3>Source du lot signé</h3>
      <p>{source?.issuerName ?? manifest.issuerId}</p>
      <p>
        {source
          ? source.valid
            ? 'Signature du relevé valide · Source approuvée'
            : source.reason
          : 'Signature et approbation à vérifier'}
      </p>
      <p className="help">
        Émis le {date(manifest.issuedAt)} · Expire le {date(manifest.expiresAt)}
      </p>
      <p className="help">
        Exhaustivité du lot signé : toutes les pièces certifiées participent au calcul. L’autorité
        de confiance certifie l’ensemble des factures et avoirs de cette entreprise pour la période.
        La preuve protège ce lot contre toute suppression, substitution ou ajout après signature.
        L’exhaustivité initiale repose sur l’autorité.
      </p>
      <details className="journey-details">
        <summary>Contrôles et détails techniques</summary>
        <p className="help">
          {circuit?.vat.programVersion === 2
            ? 'Programme TVA v2 : l’unicité des identifiants de pièces est également imposée dans le circuit.'
            : 'Programme TVA initial : l’unicité des identifiants est contrôlée avant signature par la source ; le circuit garantit la conservation du lot signé.'}
        </p>
        {manifest.format === 'clair-vat-manifest/2' && (
          <p className="help">
            Documents UBL 2.1 : empreinte des originaux couverte par le relevé signé. Validation
            annoncée par la source : EN16931 {manifest.validation.en16931}, Peppol{' '}
            {manifest.validation.peppol} selon le profil.
          </p>
        )}
        <h4>Identifiant de la clé de la source</h4>
        <code className="hash">{manifest.keyHash}</code>
        <h4>Empreinte du lot certifié</h4>
        <code className="hash">{manifest.commitment}</code>
        <p className="notice">
          Prototype : EUR, 20 %, 10 %, 5,5 %, 2,1 % et postes sans TVA certifiés. Les catégories AE
          (autoliquidation) et G (export) apportent une TVA facturée nulle. La TVA due par
          l’acquéreur n’est pas calculée. Rattachement à la date de facture, arrondi par facture et
          par taux ; hors TVA sur encaissements, achats déductibles et déclaration CA3.
        </p>
      </details>
    </section>
  );
}
