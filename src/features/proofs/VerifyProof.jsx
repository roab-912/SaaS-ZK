import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { LoaderCircle, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { launchProof, compileForEngine } from '../../lib/zk-client.js';
import {
  validateCircuit,
  circuitHash,
  describe,
  proofSchema,
  publicValues,
} from '../../../shared/circuit.mjs';
export function Verify({ initial, notify }) {
  const [envelope, setEnvelope] = useState(initial),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [status, setStatus] = useState(null),
    [expected, setExpected] = useState('');
  const task = useRef(),
    input = useRef(),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      task.current?.cancel();
    },
    [],
  );
  const load = async (file) => {
    setStatus(null);
    setEnvelope(null);
    try {
      if (!file) return;
      if (file.size > 300000) throw Error();
      const raw = JSON.parse(await file.text());
      validateCircuit(raw.circuit);
      setEnvelope(proofSchema.parse(raw));
    } catch {
      notify('Ce fichier n’est pas une preuve Clair valide (300 Ko maximum).', true);
    }
  };
  const verify = async () => {
    const run = ++generation.current;
    setBusy(true);
    setStatus(null);
    try {
      const hash = await circuitHash(envelope.circuit);
      if (expected.trim() && expected.trim().toLowerCase() !== hash)
        throw Error('Le circuit ne correspond pas à l’empreinte attendue.');
      setProgress('Reconstruction du circuit public…');
      const compiled = await compileForEngine(envelope.circuit, envelope.engine);
      if (run !== generation.current) return;
      task.current = launchProof({ mode: 'verify', envelope, compiled }, setProgress);
      const result = await task.current.promise;
      if (run === generation.current) setStatus(result.valid ? 'valid' : 'invalid');
    } catch (e) {
      if (run === generation.current) {
        setStatus('invalid');
        notify(e.message, true);
      }
    } finally {
      if (run === generation.current) setBusy(false);
    }
  };
  let fields = [];
  try {
    if (envelope) fields = publicValues(envelope);
  } catch {}
  return (
    <>
      <PageHeading
        title="Vérifier une preuve"
        desc="Une vérification ouverte à tous, sans compte ni abonnement."
      />
      <div className="verify-layout">
        <section className="panel form-panel">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) load(e.dataTransfer.files[0]);
            }}
          >
            <span className="empty-icon">
              <Upload size={27} />
            </span>
            <h3>{envelope ? 'Fichier chargé' : 'Déposez votre preuve ici'}</h3>
            <p>{envelope ? envelope.circuit.name : 'Un fichier .clair.json généré avec Clair'}</p>
            <Button disabled={busy} variant="secondary" onClick={() => input.current.click()}>
              {envelope ? 'Choisir un autre fichier' : 'Parcourir les fichiers'}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".json"
              aria-label="Fichier de preuve"
              hidden
              onChange={(e) => load(e.target.files[0])}
            />
          </div>
          <label>
            Empreinte du circuit attendu <small>(facultatif)</small>
            <input
              disabled={busy}
              placeholder="Empreinte SHA-256 fournie par le demandeur"
              value={expected}
              onChange={(e) => {
                setExpected(e.target.value);
                setStatus(null);
              }}
            />
          </label>
          <p className="help">
            Comparez la règle et ses paramètres à votre demande. Le titre d’un circuit ne garantit
            pas sa signification.
          </p>
          <Button variant="full" disabled={!envelope || busy} onClick={verify}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <ShieldCheck size={18} />}Vérifier
            la preuve
          </Button>
          {busy && (
            <p className="progress" role="status">
              {progress}
            </p>
          )}
          {status && (
            <div className={'validation ' + (status === 'invalid' ? 'invalid' : '')} role="status">
              {status === 'valid' ? <ShieldCheck size={22} /> : <X size={22} />}
              <div>
                <strong>
                  {status === 'valid' ? 'Preuve cryptographiquement valide' : 'Preuve invalide'}
                </strong>
                <p>
                  {status === 'valid'
                    ? 'La règle affichée est satisfaite pour des données déclarées.'
                    : 'La preuve, le circuit ou les paramètres ne correspondent pas.'}
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="panel explanation">
          <h2>Ce que contient la preuve</h2>
          {envelope ? (
            <>
              <Badge>Données déclarées · Non certifiées</Badge>
              <h3>{envelope.circuit.name}</h3>
              <p>{envelope.circuit.description}</p>
              <div className="statement">{describe(envelope.circuit)}</div>
              <h4>Valeurs publiques</h4>
              {fields.length ? (
                fields.map((i) => (
                  <div className="public-row" key={i.id}>
                    <span>{i.label}</span>
                    <strong>
                      {i.type === 'date'
                        ? String(i.value).replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')
                        : String(i.value)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="muted">Aucune valeur saisie publique.</p>
              )}
              <h4>Empreinte du circuit</h4>
              <code className="hash">{envelope.circuitHash}</code>
              <details>
                <summary>Consulter le circuit complet</summary>
                <pre>{JSON.stringify(envelope.circuit, null, 2)}</pre>
              </details>
              <div className="notice">
                La preuve porte sur ces paramètres, y compris les dates affichées. Elle ne se met
                pas à jour avec le temps et ne prouve pas l’identité de la personne qui la présente.
              </div>
            </>
          ) : (
            <Empty icon={Search} title="Tout est vérifiable.">
              La règle, ses entrées publiques et son empreinte apparaîtront ici.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
