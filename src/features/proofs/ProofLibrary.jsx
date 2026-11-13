import React, { useState } from 'react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog.jsx';
import { CopyButton } from '../../components/CopyButton.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { matchesSearch } from '../../lib/search.js';
import { Download, FileCheck2, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Empty, PageHeading, AccountEmpty } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { date, circuitName } from '../../lib/format.js';
export function ProofLibrary({
  user,
  nav,
  setAuth,
  proofs,
  openVerify,
  refresh,
  notify = () => {},
}) {
  const [query, setQuery] = useState(''),
    [deleting, setDeleting] = useState(null);
  const visible = proofs.filter((p) =>
    matchesSearch(
      query,
      circuitName(p.envelope.circuit),
      p.envelope.circuit.description,
      p.envelope.circuitHash,
      p.id,
      p.envelope.vatManifest?.companyId,
    ),
  );
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
      {user && proofs.length > 0 && (
        <SearchField
          label="Rechercher une preuve"
          value={query}
          onChange={setQuery}
          count={visible.length}
        />
      )}
      {user && proofs.length > 0 && !visible.length && (
        <Empty title="Aucune preuve ne correspond à cette recherche.">
          Essayez un autre nom ou une partie de l’empreinte.
        </Empty>
      )}
      {!user ? (
        <AccountEmpty open={() => setAuth('login')} />
      ) : proofs.length ? (
        <div className="proof-grid">
          {visible.map((p) => (
            <div className="panel proof-card" key={p.id}>
              <div className="template-top">
                <span className="template-icon sage">
                  <FileCheck2 size={22} />
                </span>
                <Badge>
                  {p.envelope.vatManifest
                    ? 'Relevé TVA signé · À vérifier'
                    : p.envelope.privateAttestations?.length
                      ? 'Attestations privées · À vérifier'
                      : p.envelope.attestations?.length
                        ? 'Attestations jointes · À vérifier'
                        : 'Données déclarées'}
                </Badge>
              </div>
              <h3>{circuitName(p.envelope.circuit)}</h3>
              <p className="muted">Enregistrée le {date(p.created)}</p>
              <span className="hash-with-copy">
                <code>{p.envelope.circuitHash.slice(0, 16)}…</code>
                <CopyButton
                  value={p.envelope.circuitHash}
                  label={'Copier l’empreinte de la preuve ' + circuitName(p.envelope.circuit)}
                />
              </span>
              <div className="proof-actions">
                <Button
                  variant="secondary small"
                  onClick={() =>
                    download(p.envelope, circuitName(p.envelope.circuit) + '.preuve.clair')
                  }
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
                    setDeleting(p);
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
      {deleting && (
        <ConfirmationDialog
          title="Supprimer cette preuve ?"
          confirmLabel="Supprimer la preuve"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await api('/proofs/' + deleting.id, {}, 'DELETE');
            await refresh();
            notify('Preuve supprimée de votre espace.');
          }}
        >
          <p>
            L’archive {circuitName(deleting.envelope.circuit)} sera retirée de votre espace. Les
            fichiers déjà téléchargés restent utilisables.
          </p>
        </ConfirmationDialog>
      )}
    </>
  );
}
