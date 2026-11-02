import React, { useState } from 'react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog.jsx';
import { CopyButton } from '../../components/CopyButton.jsx';
import { engineName } from '../../../shared/engines.mjs';
import { ArrowRight, GitBranch, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../components/ui.jsx';
import { date, circuitName } from '../../lib/format.js';
export function CircuitTable({ circuits, onEdit, onProve, onDelete, notify = () => {} }) {
  const [deleting, setDeleting] = useState(null);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NOM DU CIRCUIT</th>
              <th>ENTRÉES</th>
              <th>CRÉÉ LE</th>
              <th>VERSION</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {circuits.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="circuit-title" onClick={() => onEdit(c)}>
                    <span className="table-icon">
                      <GitBranch size={18} />
                    </span>
                    <span>
                      <strong>{circuitName(c.schema)}</strong>
                      <small>
                        {c.schema.vat
                          ? 'Relevé exhaustif signé · TVA'
                          : c.schema.inputs.some((i) => i.source === 'signed')
                            ? 'Attestations requises'
                            : 'Données déclarées'}{' '}
                        · {engineName(c.schema.engine)}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge>{c.schema.inputs.length} entrées</Badge>
                </td>
                <td className="muted">{date(c.created || Date.now())}</td>
                <td>
                  <span className="hash-with-copy">
                    <code title={c.hash}>{c.hash.slice(0, 8)}</code>
                    <CopyButton
                      value={c.hash}
                      label={'Copier l’empreinte de ' + circuitName(c.schema)}
                    />
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <Button variant="small secondary" onClick={() => onProve(c)}>
                      Générer <ArrowRight size={14} />
                    </Button>
                    {onDelete && (
                      <button
                        className="icon-button"
                        aria-label={'Supprimer ' + circuitName(c.schema)}
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleting && (
        <ConfirmationDialog
          title="Supprimer ce circuit ?"
          confirmLabel="Supprimer le circuit"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await onDelete(deleting);
            notify('Circuit supprimé de votre espace.');
          }}
        >
          <p>
            {circuitName(deleting.schema)} sera retiré de votre espace. Les preuves déjà exportées
            restent vérifiables.
          </p>
        </ConfirmationDialog>
      )}
    </>
  );
}
