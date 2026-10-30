import React from 'react';
import { Check } from 'lucide-react';

export function JourneySteps({ steps, current, label = 'Votre progression' }) {
  return (
    <ol className="journey-steps" aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'complete' : index === current ? 'current' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="journey-number" aria-hidden="true">
            {index < current ? <Check size={16} /> : index + 1}
          </span>
          <span>
            <strong>{step}</strong>
            <small>
              {index < current ? 'Terminé' : index === current ? 'En cours' : 'À venir'}
            </small>
          </span>
        </li>
      ))}
    </ol>
  );
}
