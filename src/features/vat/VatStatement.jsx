import React from 'react';
import { Badge } from '../../components/ui.jsx';
import { date, displayDate } from '../../lib/format.js';
import { vatMoney } from '../../../shared/vat.mjs';
export function VatStatement({ manifest, sales, credits, source, proved = false }) {
  if (!manifest) return null;
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
      <div className="public-row">
        <span>Entreprise</span>
        <strong>{manifest.companyId}</strong>
      </div>
      <div className="public-row">
        <span>Période incluse</span>
        <strong>
          {displayDate(manifest.periodStart)} au {displayDate(manifest.periodEnd)}
        </strong>
      </div>
      <div className="public-row">
        <span>Factures et avoirs</span>
        <strong>{manifest.count}</strong>
      </div>
      <div className="public-row">
        <span>TVA des ventes</span>
        <strong>{vatMoney(sales)}</strong>
      </div>
      <div className="public-row">
        <span>TVA des avoirs</span>
        <strong>{vatMoney(credits)}</strong>
      </div>
      <div className="public-row">
        <span>TVA collectée après avoirs</span>
        <strong>{vatMoney(sales - credits)}</strong>
      </div>
      {manifest.format === 'clair-vat-manifest/2' && (
        <p className="help">
          Documents UBL 2.1 : empreinte des originaux couverte par le relevé signé. Validation
          annoncée par la source : EN16931 {manifest.validation.en16931}, Peppol{' '}
          {manifest.validation.peppol} selon le profil.
        </p>
      )}
      <h3>Source du relevé exhaustif</h3>
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
      <code className="hash">{manifest.keyHash}</code>
      <details>
        <summary>Empreinte du lot certifié</summary>
        <code className="hash">{manifest.commitment}</code>
      </details>
      <p className="help">
        La preuve couvre toutes les pièces du relevé signé par cette source. L’autorité certifie son
        exhaustivité pour cette entreprise et cette période ; elle ne prouve pas l’absence de
        factures inconnues de cette autorité.
      </p>
      <div className="notice">
        Prototype : EUR, 20 %, 10 %, 5,5 %, 2,1 % et postes sans TVA certifiés. Les catégories AE
        (autoliquidation) et G (export) apportent une TVA facturée nulle. La TVA due par l’acquéreur
        n’est pas calculée. Rattachement à la date de facture, arrondi par facture et par taux ;
        hors TVA sur encaissements, achats déductibles et déclaration CA3.
      </div>
    </section>
  );
}
