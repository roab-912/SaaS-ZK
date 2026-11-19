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
      <details className="journey-details">
        <summary>Comment l’exhaustivité est-elle garantie ?</summary>
        <p>
          L’autorité signe l’entreprise, la période clôturée, le nombre de pièces et une empreinte
          de tout le lot. Le circuit reconstruit cette empreinte à partir des données privées et
          exige qu’elle corresponde exactement au relevé signé. Le vérificateur contrôle aussi la
          signature et l’approbation actuelle de la source.
        </p>
        <p>
          Par exemple, pour 100 pièces certifiées, calculer la TVA sur seulement 99 pièces ne permet
          pas d’obtenir une preuve valide pour ce relevé. Retirer, ajouter, remplacer, dupliquer ou
          réordonner une pièce après signature est détecté. Modifier aussi le nombre ou l’empreinte
          exige une nouvelle signature de l’autorité.
        </p>
        <p>
          Notre modèle fait confiance à l’autorité pour certifier l’ensemble des factures. Il ne
          nécessite pas de faire confiance à l’entreprise qui reçoit le lot ou à la personne qui
          transmet la preuve. L’exhaustivité initiale vient de l’autorité ; sa préservation et le
          calcul sont vérifiés cryptographiquement.
        </p>
      </details>
      <details className="journey-details">
        <summary>Quels contrôles sont imposés par le circuit ?</summary>
        <ul className="vat-guarantees-list">
          <li>
            Dates calendaires valides et comprises entre les deux bornes publiques de la période.
          </li>
          <li>
            Nombre exact de pièces, engagement du lot lié à l’entreprise et à la période,
            emplacements inutilisés entièrement nuls.
          </li>
          {uniqueInCircuit && (
            <li>
              Identifiants distincts pour toutes les pièces actives, même si leurs montants sont
              identiques.
            </li>
          )}
          <li>
            Distinction facture / avoir ; un avoir porte une référence non vide, différente de son
            propre identifiant.
          </li>
          <li>Présence d’un motif engagé pour une base positive sans TVA.</li>
          <li>
            Bases et taxes bornées, calcul en centimes entiers, égalité exacte avec les deux
            sous-totaux publics.
          </li>
        </ul>
        <p>
          Ces conditions sont obligatoires pour produire une preuve valide, même avec un logiciel de
          génération modifié. À la réception, changer le montant, l’entreprise ou la période d’une
          preuve invalide sa vérification.
        </p>
      </details>
      <details className="journey-details">
        <summary>Quelles règles de TVA sont appliquées ?</summary>
        <p>
          Ventes et avoirs en EUR, de 1 à 500 pièces. Taux pris en charge : 20 %, 10 %, 5,5 %, 2,1 %
          et postes sans TVA certifiés. Pour chaque facture, les bases sont regroupées par taux. La
          taxe est arrondie au centime le plus proche, le demi-centime vers le haut, par facture et
          par taux. Les avoirs sont calculés sur des montants positifs puis soustraits.
        </p>
        <p>
          Une base par taux est limitée à 1 000 000,00 €. Chaque sous-total de TVA, ventes ou
          avoirs, est limité à 42 949 672,95 €. Le solde peut être négatif. Un lot vide ou supérieur
          à 500 pièces n’est pas pris en charge ; plusieurs preuves ne constituent pas
          automatiquement une preuve d’exhaustivité de leur ensemble.
        </p>
        <p>
          <strong>Le rattachement utilise la date de facture.</strong> Le résultat est la TVA
          facturée nette des avoirs sur la période, selon cette convention. Le programme ne calcule
          pas la TVA sur encaissements, les achats déductibles ou une déclaration CA3. Les
          catégories d’autoliquidation et d’export prises en charge contribuent pour zéro à la TVA
          facturée du vendeur ; la TVA à autoliquider par l’acquéreur n’est pas calculée.
        </p>
      </details>
      <details className="journey-details">
        <summary>Que certifie l’autorité de confiance ?</summary>
        <p>
          L’autorité certifie l’origine et l’exhaustivité des pièces, leur appartenance à
          l’entreprise, la correspondance entre les XML originaux et les données utilisées, ainsi
          que la qualification fiscale des taux et des postes sans TVA. L’import contrôle les
          documents UBL avant signature ; le circuit calcule sur leurs données normalisées privées.
        </p>
        <p>
          La justification d’un avoir et son historique restent à la charge de l’autorité : sa
          facture d’origine peut appartenir à une période antérieure. Le circuit ne vérifie pas
          l’existence de cette facture ni le cumul des corrections historiques. Il ne détermine pas
          non plus si un relevé plus récent a remplacé celui présenté.
        </p>
      </details>
      <details className="journey-details">
        <summary>Que voit le destinataire et que doit-il vérifier ?</summary>
        <p>
          Les factures, leurs identifiants, leurs montants individuels, les XML et le masque de
          confidentialité restent privés. La preuve rend publics l’entreprise, la période, le nombre
          de pièces, les sous-totaux, leur différence et le relevé signé avec son empreinte.
        </p>
        <p>
          Le destinataire vérifie la preuve et la signature, puis s’assure que l’entreprise, la
          période et les règles de calcul correspondent à sa demande. Une preuve valide pour
          septembre ne répond pas à une demande portant sur tout un trimestre. Le relevé doit être
          encore valide et sa source toujours approuvée au moment du contrôle.
        </p>
      </details>
    </section>
  );
}
