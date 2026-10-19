import React from 'react';
import { Download, FileCheck2, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Empty, PageHeading, AccountEmpty } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { date } from '../../lib/format.js';
export function ProofLibrary({ user, nav, setAuth, proofs, openVerify, refresh }) {
  return (
    <>
      <PageHeading
        title="Mes preuves"
        desc="Des preuves réutilisables, sans leurs données privées."
        action={
          <Button variant="secondary" onClick={() => nav('verify')}>
            <Upload size={17} />
            Vérifier un fichier
          </Button>
        }
      />
      {!user ? (
        <AccountEmpty open={() => setAuth('login')} />
      ) : proofs.length ? (
        <div className="proof-grid">
          {proofs.map((p) => (
            <div className="panel proof-card" key={p.id}>
              <div className="template-top">
                <span className="template-icon sage">
                  <FileCheck2 size={22} />
                </span>
                <Badge>
                  {p.envelope.attestations?.length
                    ? 'Attestations jointes · À vérifier'
                    : 'Données déclarées'}
                </Badge>
              </div>
              <h3>{p.envelope.circuit.name}</h3>
              <p className="muted">Enregistrée le {date(p.created)}</p>
              <code>{p.envelope.circuitHash.slice(0, 16)}…</code>
              <div className="proof-actions">
                <Button
                  variant="secondary small"
                  onClick={() => download(p.envelope, p.envelope.circuit.name + '.clair.json')}
                >
                  <Download size={15} />
                  Télécharger
                </Button>
                <Button variant="small" onClick={() => openVerify(p.envelope)}>
                  Vérifier
                </Button>
                <button
                  className="icon-button"
                  aria-label="Supprimer la preuve"
                  onClick={async () => {
                    await api('/proofs/' + p.id, {}, 'DELETE');
                    await refresh();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={FileCheck2}
          title="Vos preuves vous attendront ici."
          action={<Button onClick={() => nav('circuits')}>Choisir un circuit</Button>}
        >
          Générez une preuve puis enregistrez-la dans votre espace.
        </Empty>
      )}
    </>
  );
}
