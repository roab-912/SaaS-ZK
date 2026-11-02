import { KnowledgeDiagram } from './KnowledgeDiagram.jsx';
import React from 'react';
import { Fingerprint, GitBranch, ShieldCheck } from 'lucide-react';
import { displayDate } from '../../lib/format.js';
import { Button, PageHeading } from '../../components/ui.jsx';
export const GUIDE_UPDATED_ON = '2026-11-02';
export function Guide({ onNavigate }) {
  return (
    <>
      <PageHeading
        title="Comprendre le zero knowledge"
        desc="Prouver une information sans révéler les valeurs privées qui permettent de la vérifier."
        action={
          onNavigate && (
            <Button variant="secondary" onClick={() => onNavigate('faq')}>
              Consulter la FAQ
            </Button>
          )
        }
      />
      <KnowledgeDiagram />
      <div className="guide-grid">
        {[
          [
            GitBranch,
            '01',
            'Choisissez ce que vous voulez prouver',
            'Partez d’un modèle : majorité, revenus ou TVA collectée. Un « circuit » est simplement la règle qui sera vérifiée. Vous pouvez aussi créer votre propre règle.',
          ],
          [
            Fingerprint,
            '02',
            'Ajoutez vos informations',
            'Remplissez les champs demandés. Si une information doit être certifiée, importez l’attestation reçue de sa source. Pour la TVA, vous pouvez importer vos XML, faire signer le lot puis continuer vers la preuve.',
          ],
          [
            ShieldCheck,
            '03',
            'Créez et partagez votre preuve',
            'Téléchargez le fichier de preuve .clair, puis transmettez-le à votre destinataire. Il pourra le vérifier gratuitement, sans compte. Le détail des informations privées reste sur votre appareil.',
          ],
        ].map(([Icon, n, title, desc]) => (
          <section className="panel explanation" key={n}>
            <div className="template-top">
              <span className="template-icon sage">
                <Icon size={23} />
              </span>
              <span className="muted">{n}</span>
            </div>
            <h2>{title}</h2>
            <p>{desc}</p>
          </section>
        ))}
      </div>
      {onNavigate && (
        <div className="journey-actions">
          <Button onClick={() => onNavigate('circuits')}>Choisir un modèle</Button>
          <Button variant="secondary" onClick={() => onNavigate('verify')}>
            Vérifier un fichier reçu
          </Button>
        </div>
      )}
      <section className="panel guide-details">
        <h2>Les mots utiles</h2>
        <p>
          <strong>Circuit :</strong> la règle à prouver, par exemple « mon revenu dépasse ce seuil
          ».
        </p>
        <p>
          <strong>Preuve :</strong> le fichier qui permet de vérifier le résultat sans révéler les
          valeurs privées.
        </p>
        <p>
          <strong>Attestation :</strong> une information signée par une source de confiance, comme
          une banque ou votre logiciel de facturation.
        </p>
        <p>
          <strong>Lot signé :</strong> vos factures privées accompagnées de la signature de la
          source. Conservez-le ; c’est la preuve, créée ensuite, que vous partagez avec le
          destinataire.
        </p>
        <h2>Ce qu’une preuve garantit</h2>
        <p>
          Une preuve valide confirme que la règle produit le résultat affiché. Une règle peut donner
          vrai ou faux : vérifiez aussi ce résultat. Les données librement déclarées n’ont pas de
          provenance certifiée. Une signature permet d’identifier la source, sans garantir
          l’identité de la personne qui présente la preuve.
        </p>
        <p className="help">
          Guide mis à jour le{' '}
          <time dateTime={GUIDE_UPDATED_ON}>{displayDate(GUIDE_UPDATED_ON)}</time>.
        </p>
      </section>
    </>
  );
}
