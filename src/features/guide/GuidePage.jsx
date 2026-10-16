import React from 'react';
import { Fingerprint, GitBranch, ShieldCheck } from 'lucide-react';
import { PageHeading } from '../../components/ui.jsx';
export function Guide() {
  return (
    <>
      <PageHeading title="Prouver, sans tout révéler." desc="Le zero knowledge en trois étapes." />
      <div className="guide-grid">
        {[
          [
            GitBranch,
            '01',
            'Définissez une règle',
            'Un circuit décrit les conditions à satisfaire : une comparaison, une liste, un calcul ou plusieurs conditions combinées. Le circuit et les valeurs fixes sont publics.',
          ],
          [
            Fingerprint,
            '02',
            'Calculez votre preuve',
            'Saisissez vos valeurs privées dans le navigateur. Un moteur cryptographique local démontre que les conditions sont satisfaites. Seuls la preuve et les paramètres publics peuvent être enregistrés.',
          ],
          [
            ShieldCheck,
            '03',
            'Partagez ce qui compte',
            'Votre destinataire importe le fichier, lit la règle et vérifie la preuve. Il doit s’assurer que la règle, ses dates et ses valeurs publiques correspondent à sa demande.',
          ],
        ].map(([Icon, n, title, desc]) => (
          <section className="panel explanation" key={n}>
            <div className="template-top">
              <span className="template-icon sage">
                <Icon size={23} />
              </span>
              <span className="muted">{n}</span>
            </div>
            <h2>{title}</h2>
            <p>{desc}</p>
          </section>
        ))}
      </div>
      <section className="panel guide-details">
        <h2>Ce qu’une preuve garantit</h2>
        <p>
          Elle garantit qu’il existe des valeurs qui satisfont exactement la règle affichée. Dans ce
          MVP, les valeurs sont librement déclarées : la preuve ne garantit pas qu’elles
          correspondent à la réalité, ni qu’elles appartiennent à la personne qui présente le
          fichier.
        </p>
        <h3>Et dans six mois ?</h3>
        <p>
          La vérification cryptographique reste possible. La pertinence dépend de la règle : être né
          avant une date reste vrai, tandis qu’un montant de revenus peut changer. La date de
          référence fait partie des paramètres à examiner.
        </p>
        <h3>Qu’est-ce qui quitte mon appareil ?</h3>
        <p>
          La description publique du circuit est envoyée au compilateur. Les entrées privées et les
          données intermédiaires du calcul restent dans le navigateur. Si vous choisissez
          d’enregistrer la preuve, son fichier public rejoint votre espace. Les noms, descriptions
          et constantes d’un circuit ne doivent pas contenir de secrets.
        </p>
        <h3>Les sources certifiées</h3>
        <p>
          Les futurs connecteurs permettront de vérifier une signature d’émetteur à l’intérieur de
          la preuve, puis d’appliquer la règle aux attributs signés. Le registre des émetteurs
          approuvés prépare cette évolution.
        </p>
      </section>
    </>
  );
}
