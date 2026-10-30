import React from 'react';
import { engineName } from '../../../shared/engines.mjs';
import { ArrowRight, GitBranch, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../components/ui.jsx';
import { date } from '../../lib/format.js';
export function CircuitTable({ circuits, onEdit, onProve, onDelete }) {
  return (
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
                    <strong>{c.schema.name}</strong>
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
                <code>{c.hash.slice(0, 8)}</code>
              </td>
              <td>
                <div className="row-actions">
                  <Button variant="small secondary" onClick={() => onProve(c)}>
                    Générer <ArrowRight size={14} />
                  </Button>
                  {onDelete && (
                    <button
                      className="icon-button"
                      aria-label={'Supprimer ' + c.schema.name}
                      onClick={() => onDelete(c)}
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
  );
}
