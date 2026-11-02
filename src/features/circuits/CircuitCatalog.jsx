import { matchesSearch } from '../../lib/search.js';
import React, { useState } from 'react';
import { ArrowRight, Braces, Fingerprint, ListFilter, LoaderCircle } from 'lucide-react';
import { ENGINE, ZK_ENGINES } from '../../../shared/engines.mjs';
import { CIRCUIT_CATALOG } from './catalog-model.js';
export function CircuitCatalog({ onChoose, pending, query = '' }) {
  const [engine, setEngine] = useState(ENGINE);
  const icons = {
    age: Fingerprint,
    revenue: Braces,
    income: Braces,
    list: ListFilter,
    vat: Braces,
  };
  return (
    <section aria-label="Circuits prêts à utiliser" className="circuit-catalog">
      <div className="section-heading">
        <div>
          <h2>Que souhaitez-vous prouver ?</h2>
          <p>
            Choisissez un modèle, ajoutez vos informations et créez votre preuve. Aucune
            connaissance technique n’est nécessaire.
          </p>
        </div>
      </div>
      <div className="templates catalog-grid">
        {CIRCUIT_CATALOG.filter((item) =>
          matchesSearch(query, item.title, item.description, item.category, item.fields),
        ).map((item) => {
          const Icon = icons[item.id];
          return (
            <button
              key={item.id}
              className="template-card"
              aria-label={'Utiliser ' + item.title}
              disabled={!!pending || (item.id === 'vat' && engine !== ENGINE)}
              title={
                item.id === 'vat' && engine !== ENGINE
                  ? 'Sélectionnez Noir dans les options avancées'
                  : undefined
              }
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
      {query &&
        !CIRCUIT_CATALOG.some((item) =>
          matchesSearch(query, item.title, item.description, item.category, item.fields),
        ) && (
          <p role="status" className="help">
            Aucun modèle ne correspond à votre recherche.
          </p>
        )}
      <p className="help">
        Un circuit est une règle à vérifier. Les modèles ci-dessus sont prêts à l’emploi. Pour la
        TVA, un parcours vous guide de l’import des factures jusqu’à la preuve. Vos informations
        privées restent sur votre appareil.
      </p>
      <details className="catalog-options">
        <summary>Options avancées</summary>
        <p className="help">
          Le moteur recommandé est déjà sélectionné. Vous pouvez conserver ce choix pour commencer.
        </p>
        <p className="help">
          Le circuit compte dans votre abonnement à son enregistrement ou à la première preuve. Le
          réutiliser ne crée pas de doublon.
        </p>
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
