import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, PageHeading } from '../../components/ui.jsx';
import { OperationProgress } from '../../components/OperationProgress.jsx';
import { download } from '../../lib/files.js';
import { compileForEngine, launchProof } from '../../lib/zk-client.js';
import { parseVatBatch, vatCircuit, vatMoney, vatPublicValues } from '../../../shared/vat.mjs';

export function VatDemoGuide() {
  const [kit, setKit] = useState(null);
  const [kitError, setKitError] = useState('');
  const [progress, setProgress] = useState('');
  const [stage, setStage] = useState('prepare');
  const [error, setError] = useState('');
  const [proof, setProof] = useState(null);
  const operation = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/demo-tva/session.json', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const data = await response.json();
        // The original 500-piece kit predates the volume and amount fields.
        if (data.count === undefined && data.netCents === undefined) {
          data.count = 500;
          data.netCents = 3191700;
        }
        if (
          !/^kit-[A-Za-z0-9]+$/.test(data.id) ||
          !/^\d{4}-01$/.test(data.month) ||
          ![100, 500].includes(data.count) ||
          !Number.isSafeInteger(data.netCents) ||
          !Number.isFinite(Date.parse(data.expiresAt))
        )
          throw Error();
        if (Date.parse(data.expiresAt) <= Date.now()) {
          setKitError(
            'Les relevés de cet exercice ont expiré. La personne qui prépare la démonstration peut renouveler le kit avec npm run demo:tva:offline.',
          );
        } else setKit(data);
      } catch {
        if (!controller.signal.aborted)
          setKitError(
            'Les fichiers de démonstration sont indisponibles. Sur le poste de préparation, exécutez npm run demo:tva:offline, puis rechargez cette page.',
          );
      }
    }
    load();
    return () => {
      controller.abort();
      operation.current?.abort();
    };
  }, []);
  const base = kit && '/demo-tva/' + kit.id + '/';
  const january = kit ? 'janvier ' + kit.month.slice(0, 4) : 'janvier';
  function file(label, name) {
    if (!kit) return null;
    return (
      <a
        className="button secondary"
        href={base + name.replace(/\.clair$/, '.json')}
        download={name}
      >
        <Download size={15} aria-hidden="true" />
        {label}
      </a>
    );
  }
  async function generate() {
    if (!kit || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setError('');
    setProof(null);
    setStage('prepare');
    setProgress('Lecture du lot fictif de janvier…');
    try {
      const response = await fetch(base + 'janvier.originaux.json', { signal: controller.signal });
      if (!response.ok) throw Error('Le lot de janvier est indisponible.');
      const batch = parseVatBatch(await response.json());
      if (batch.manifest.signature !== kit.januarySignature || batch.manifest.count !== kit.count)
        throw Error('Le lot ne correspond pas à cette session de démonstration.');
      const circuit = vatCircuit(batch.manifest.count);
      setProgress('Préparation du circuit public…');
      const compiled = await compileForEngine(circuit, circuit.engine, controller.signal);
      controller.signal.throwIfAborted();
      const task = launchProof(
        {
          mode: 'prove',
          demoKit: kit.id,
          circuit,
          compiled,
          vatBatch: batch,
          values: vatPublicValues(batch),
          issuers: [kit.source],
        },
        setProgress,
        { timeout: 900000, onStage: setStage },
      );
      controller.signal.addEventListener('abort', task.cancel, { once: true });
      const result = await task.promise;
      if (!controller.signal.aborted) setProof(result);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e.message || 'La génération a échoué. Réessayez ou utilisez la preuve de référence.',
        );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setProgress('');
    }
  }
  return (
    <>
      <PageHeading
        title="Démonstration TVA hors ligne"
        desc="Générez une preuve pour un mois de facturation. Sur un second poste, vérifiez le montant du mois, puis retrouvez les XML certifiés lors d’un contrôle sur pièces."
      />
      {kitError && (
        <p className="validation invalid" role="alert">
          {kitError}
        </p>
      )}
      {!kit && !kitError && <p role="status">Chargement des fichiers de démonstration…</p>}
      <div className="vat-demo-steps">
        <section className="panel">
          <h2>1. Générer la preuve sur le poste de l’entreprise</h2>
          <p>
            Le lot de {january} contient les {kit?.count} XML fictifs et le relevé signé par la
            plateforme de démonstration. Téléchargez-le pour le conserver chez l’entreprise. Le
            bouton de génération charge ce même lot et calcule une nouvelle preuve dans votre
            navigateur. Gardez cet onglet ouvert et le poste connecté pendant le calcul.
          </p>
          <div className="journey-actions">
            {!proof && file('Télécharger janvier.originaux.clair', 'janvier.originaux.clair')}
            <Button onClick={generate} disabled={!kit || !!progress}>
              Générer ma preuve de janvier
            </Button>
          </div>
          {progress && (
            <OperationProgress
              stage={stage}
              message={progress}
              onCancel={() => {
                operation.current?.abort();
                setProgress('');
              }}
            />
          )}
          {error && (
            <p className="validation invalid" role="alert">
              {error}
            </p>
          )}
          {proof && (
            <div className="result-panel">
              <p role="status">
                Votre preuve de janvier est prête. Transmettez ce fichier à l’agent.
              </p>
              <Button onClick={() => download(proof, 'ma-preuve-janvier.clair')}>
                Télécharger ma preuve de janvier
              </Button>
              <p>Conservez les factures signées chez l’entreprise pour le contrôle sur pièces.</p>
              {file('Télécharger janvier.originaux.clair', 'janvier.originaux.clair')}
            </div>
          )}
          <p>
            Pour commencer directement à la vérification, la preuve de référence a été générée avec
            le même lot signé.
          </p>
          {file('Preuve de janvier déjà générée', 'janvier.preuve.clair')}
          <p>
            Pour utiliser vos propres XML, ouvrez <a href="/?view=vat">Prouver la TVA collectée</a>.
            Une fois le relevé signé par la source, le formulaire de génération vous permet de
            télécharger le lot d’originaux correspondant.
          </p>
        </section>
        <section className="panel">
          <h2>2. Préparer le poste de l’agent</h2>
          <p>
            Téléchargez le vérificateur Windows 64 bits de cet exercice. Son ZIP contient le
            logiciel, le registre de la source fictive, la fiche <code>demande.txt</code> et le
            lanceur <code>demarrer.cmd</code>.
          </p>
          <div className="journey-actions">
            {file('Vérificateur de la démo (.zip)', 'verificateur.zip')}
            {file('Preuve de février (.clair)', 'fevrier.preuve.clair')}
          </div>
          <p>
            Pour vos propres preuves, téléchargez le vérificateur depuis les{' '}
            <a href="/?view=issuers">Sources de confiance</a>. Il inclut toutes les autorités
            approuvées de votre instance.
          </p>
          <p>
            Copiez le ZIP et les deux preuves publiques sur le second poste. Gardez les lots
            d’originaux chez l’entreprise. Extrayez toute l’archive, coupez le réseau, puis
            double-cliquez sur <code>demarrer.cmd</code>. Le premier lancement décompresse le moteur
            et ouvre une page locale.
          </p>
        </section>
        <section className="panel">
          <h2>3. Vérifier la demande de janvier hors ligne</h2>
          <ol>
            <li>
              Choisissez <strong>Répondre à une demande mensuelle de TVA</strong>. Suivez la fiche{' '}
              <code>demande.txt</code> pour renseigner l’entreprise{' '}
              <strong>{kit?.company ?? 'FR00000000000'}</strong>, le mois de{' '}
              <strong>{january}</strong> et la source{' '}
              <strong>{kit?.source.name ?? 'Plateforme de démonstration'}</strong>.
            </li>
            <li>
              Ouvrez <code>fevrier.preuve.clair</code> et cliquez sur{' '}
              <strong>Vérifier la preuve</strong>. Le verdict « Preuve valide, période différente du
              mois demandé » montre que l’agent contrôle les dates, même lorsque les montants des
              deux mois sont identiques.
            </li>
            <li>
              Gardez les mêmes critères. Ouvrez <code>ma-preuve-janvier.clair</code> ou la référence{' '}
              <code>janvier.preuve.clair</code> et vérifiez-la. L’agent doit lire{' '}
              <strong>Demande de TVA satisfaite</strong>, le nombre de pièces
              {kit && (
                <>
                  {' '}
                  (<strong>{kit.count}</strong>)
                </>
              )}{' '}
              et le montant de TVA facturée nette des avoirs
              {kit && (
                <>
                  {' '}
                  (<strong>{vatMoney(kit.netCents)}</strong>)
                </>
              )}
              . Conservez cette preuve pour le contrôle sur pièces.
            </li>
          </ol>
        </section>
        <section className="panel">
          <h2>4. Comparer les factures à la preuve acceptée</h2>
          <p>
            Lors de ce contrôle distinct, l’entreprise remet à l’agent{' '}
            <code>janvier.originaux.clair</code>, conservé à l’étape 1. Si le vérificateur a été
            fermé, rouvrez et vérifiez d’abord la preuve de janvier conservée dans le dossier.
          </p>
          <p>
            Dans <strong>Contrôle distinct des originaux</strong>, ouvrez le lot de janvier. Le
            vérificateur recalcule l’empreinte de chaque XML et celle du lot, puis les compare au
            relevé signé associé à la preuve acceptée. Attendez la confirmation que les {kit?.count}{' '}
            originaux correspondent au relevé de la preuve acceptée, sélectionnez une pièce pour
            lire sa fiche. Ouvrez <strong>Afficher le XML original</strong> pour consulter la
            source, puis cliquez sur <strong>Fermer les originaux</strong>.
          </p>
          <p>
            Pour essayer un autre lot signé, remettez les originaux de février pour cette même
            preuve de janvier. Le vérificateur affiche <strong>Originaux refusés</strong>.
          </p>
          {file('Lot signé de février pour le contre-exemple', 'fevrier.originaux.clair')}
        </section>
      </div>
    </>
  );
}
