import React from 'react';
import { LoaderCircle } from 'lucide-react';
export function OperationProgress({
  message = 'Calcul en cours sur votre appareil…',
  completed,
  total,
  onCancel,
}) {
  const determinate =
    Number.isInteger(total) &&
    total > 0 &&
    Number.isInteger(completed) &&
    completed >= 0 &&
    completed <= total;
  return (
    <div className="operation-progress" role="status" aria-live="polite">
      <div className="operation-label">
        <LoaderCircle className="spin" size={18} aria-hidden="true" />
        <span>{message}</span>
      </div>
      <progress
        aria-label={determinate ? 'Documents vérifiés' : 'Opération en cours'}
        {...(determinate ? { value: completed, max: total } : {})}
      />
      {determinate && (
        <small>
          {completed} / {total} documents vérifiés
        </small>
      )}
      {onCancel && (
        <button type="button" className="text-link dark" onClick={onCancel}>
          Annuler
        </button>
      )}
    </div>
  );
}
