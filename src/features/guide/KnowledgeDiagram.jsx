import React, { useState } from 'react';
import { ArrowRight, FileCheck2, GitBranch, LockKeyhole, Monitor, ShieldCheck } from 'lucide-react';
export function KnowledgeDiagram() {
  const [age, setAge] = useState(24),
    result = age >= 18;
  return (
    <figure className="panel zk-flow" aria-labelledby="zk-flow-title">
      <figcaption>
        <h2 id="zk-flow-title">De vos données à la preuve</h2>
        <p>
          Vous partagez un résultat vérifiable, en gardant les valeurs privées sur votre appareil.
        </p>
      </figcaption>
      <div className="zk-flow-example" role="group" aria-label="Choisir un exemple fictif">
        <span>Exemple fictif :</span>
        {[24, 16].map((value) => (
          <button
            type="button"
            className={'button secondary small' + (age === value ? ' selected' : '')}
            key={value}
            aria-pressed={age === value}
            onClick={() => setAge(value)}
          >
            Personne de {value} ans
          </button>
        ))}
      </div>
      <div className="zk-flow-layout">
        <section className="zk-flow-device" aria-label="Sur votre appareil">
          <h3 className="zk-flow-zone">
            <Monitor size={18} aria-hidden="true" />
            Sur votre appareil
          </h3>
          <ol className="zk-flow-steps">
            <li>
              <LockKeyhole size={22} aria-hidden="true" />
              <h4>1. Vos données privées</h4>
              <strong>{age} ans</strong>
              <p>
                Dans cet exemple, votre âge. Cette valeur ne sera pas transmise au destinataire.
              </p>
              <ArrowRight className="zk-flow-link" aria-hidden="true" />
            </li>
            <li>
              <GitBranch size={22} aria-hidden="true" />
              <h4>2. La règle publique</h4>
              <strong>Avoir au moins 18 ans</strong>
              <p>Le circuit décrit la règle et les informations qui seront publiques.</p>
              <ArrowRight className="zk-flow-link" aria-hidden="true" />
            </li>
            <li>
              <FileCheck2 size={22} aria-hidden="true" />
              <h4>3. Le calcul local</h4>
              <strong>Un fichier de preuve</strong>
              <p>Clair crée la preuve du résultat sans y joindre vos valeurs privées.</p>
            </li>
          </ol>
        </section>
        <ArrowRight className="zk-flow-transfer" aria-hidden="true" />
        <section className="zk-flow-recipient" aria-labelledby="zk-flow-recipient-title">
          <ShieldCheck size={25} aria-hidden="true" />
          <h3 id="zk-flow-recipient-title">Chez le destinataire</h3>
          <p>Il reçoit la preuve, la règle, les valeurs publiques et la provenance éventuelle.</p>
          <p>Il vérifie la preuve et le circuit attendu, puis lit le résultat.</p>
          <div
            className={'zk-flow-result' + (result ? '' : ' negative')}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>Résultat de l’exemple : {result ? 'Vrai' : 'Faux'}</strong>
            <span>{result ? 'La condition est remplie.' : 'La condition n’est pas remplie.'}</span>
          </div>
          <p className="help">Il ne reçoit pas l’âge privé.</p>
        </section>
      </div>
      <p className="zk-flow-caption">
        Les deux exemples peuvent produire une preuve valide : l’un démontre un résultat vrai,
        l’autre un résultat faux. Cette illustration ne génère pas de fichier de preuve.
      </p>
      <p className="zk-flow-caption">
        Une source de confiance peut signer les données en amont pour en certifier l’origine. Sans
        signature, les données restent déclarées par l’utilisateur.
      </p>
      <p className="help zk-flow-public-note">
        La règle publique est préparée par le serveur. Les calculs utilisant vos valeurs privées
        sont réalisés sur votre appareil.
      </p>
    </figure>
  );
}
