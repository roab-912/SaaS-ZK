import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { PROOF_STEPS } from '../../shared/proof-progress.mjs';
export function OperationProgress({
  message = 'Calcul en cours sur votre appareil…',
  completed,
  total,
  stage,
  onCancel,
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((performance.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const index = PROOF_STEPS.findIndex((step) => step.id === stage);
  const determinate =
    Number.isInteger(total) &&
    total > 0 &&
    Number.isInteger(completed) &&
    completed >= 0 &&
    completed <= total;
  return (
    <div className="operation-progress">
      <div role="status" aria-live="polite" className="operation-status">
        <div className="operation-label">
          <LoaderCircle className="spin" size={18} aria-hidden="true" />
          <span>{message}</span>
        </div>
        <progress
          aria-label={
            index >= 0
              ? 'Étapes de génération terminées'
              : determinate
                ? 'Documents vérifiés'
                : 'Opération en cours'
          }
          {...(index >= 0
            ? { value: index, max: PROOF_STEPS.length }
            : determinate
              ? { value: completed, max: total }
              : {})}
        />
        {index >= 0 ? (
          <small>
            Étape {index + 1} sur {PROOF_STEPS.length} · Les étapes peuvent avoir des durées
            différentes.
          </small>
        ) : (
          determinate && (
            <small>
              {completed} / {total} documents vérifiés
            </small>
          )
        )}
      </div>
      {index >= 0 && (
        <ol className="proof-progress-steps" aria-label="Étapes de génération">
          {PROOF_STEPS.map((step, i) => (
            <li
              key={step.id}
              aria-current={i === index ? 'step' : undefined}
              className={i < index ? 'completed' : i === index ? 'active' : ''}
            >
              {i < index ? (
                <Check size={15} aria-hidden="true" />
              ) : i === index ? (
                <LoaderCircle size={15} className="spin" aria-hidden="true" />
              ) : (
                <span className="proof-step-number" aria-hidden="true">
                  {i + 1}
                </span>
              )}
              {step.label}
            </li>
          ))}
        </ol>
      )}
      <time
        className="operation-elapsed"
        aria-label="Temps écoulé"
        aria-live="off"
        dateTime={'PT' + elapsed + 'S'}
      >
        Temps écoulé :{' '}
        {elapsed < 60
          ? elapsed + ' s'
          : Math.floor(elapsed / 60) + ' min ' + String(elapsed % 60).padStart(2, '0') + ' s'}
      </time>
      {onCancel && (
        <button type="button" className="text-link dark" onClick={onCancel}>
          Annuler
        </button>
      )}
    </div>
  );
}
