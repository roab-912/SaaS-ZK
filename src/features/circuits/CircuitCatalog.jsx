import React, { useState } from 'react';
import { ArrowRight, Braces, Fingerprint, ListFilter, LoaderCircle } from 'lucide-react';
import { ENGINE, ZK_ENGINES } from '../../../shared/engines.mjs';
import { CIRCUIT_CATALOG } from './catalog-model.js';
export function CircuitCatalog({ onChoose, pending }) {
  const [engine, setEngine] = useState(ENGINE);
  const icons = { age: Fingerprint, revenue: Braces, income: Braces, list: ListFilter };
  return (
    <section aria-label="Circuits prêts à utiliser" className="circuit-catalog">
      <div className="section-heading">
        <div>
          <h2>Que souhaitez-vous prouver ?</h2>
          <p>Choisissez un circuit, renseignez vos données et générez votre preuve.</p>
        </div>
      </div>
      <div className="templates catalog-grid">
        {CIRCUIT_CATALOG.map((item) => {
          const Icon = icons[item.id];
          return (
            <button
              key={item.id}
              className="template-card"
              aria-label={'Utiliser ' + item.title}
              disabled={!!pending}
              onClick={() => onChoose(item.id, engine)}
            >
              <div className="template-top">
                <span className={'template-icon ' + item.color}>
                  <Icon size={22} />
                </span>
                {pending === item.id ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p className="catalog-fields">{item.fields}</p>
              <div className="template-footer">
                {item.category}
                <span>
                  Utiliser <ArrowRight size={15} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="help">
        Les modèles utilisent des données déclarées. Le circuit est enregistré dans votre espace et
        compte dans votre abonnement ; le réutiliser ne crée pas de doublon. Les valeurs privées
        restent sur votre appareil.
      </p>
      <details className="catalog-options">
        <summary>Options avancées</summary>
        <label>
          Moteur de preuve
          <select
            aria-label="Moteur de preuve"
            value={engine}
            disabled={!!pending}
            onChange={(e) => setEngine(e.target.value)}
          >
            {ZK_ENGINES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.experimental ? ' · Expérimental' : ''}
              </option>
            ))}
          </select>
        </label>
      </details>
    </section>
  );
}
