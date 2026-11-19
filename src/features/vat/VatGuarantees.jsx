import React from 'react';

export function VatGuarantees({ programVersion = 2 }) {
  const uniqueInCircuit = programVersion === 2;
  return (
    <section className="panel explanation vat-guarantees" aria-labelledby="vat-guarantees-title">
      <h2 id="vat-guarantees-title">Ce que la preuve garantit</h2>
      <p className="vat-guarantees-lead">
        <strong>Tout le lot signé, sans sélection possible après signature.</strong> L’autorité de
        confiance certifie 100 % des factures et avoirs de l’entreprise pour la période. La preuve
        garantit que le calcul porte exactement sur ce lot.
      </p>
      <ul className="vat-guarantees-list">
        <li>
          <strong>Exhaustivité du lot signé</strong> — chaque pièce certifiée participe au calcul.
        </li>
        <li>
          <strong>Dates dans la période</strong> — dates valides, début et fin inclus.
        </li>
        <li>
          <strong>Absence de doublons</strong> —{' '}
          {uniqueInCircuit
            ? 'chaque identifiant de pièce est unique, contrôlé dans le circuit.'
            : 'contrôlée avant signature par la source ; cet ancien programme ne la contrôle pas séparément dans le circuit.'}
        </li>
        <li>
          <strong>Montant recalculé</strong> — TVA des ventes moins TVA des avoirs, selon les règles
          ci-dessous.
        </li>
      </ul>
    </section>
  );
}
