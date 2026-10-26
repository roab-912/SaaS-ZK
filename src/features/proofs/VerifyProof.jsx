import { displayDate } from '../../lib/format.js';
import React from 'react';
import { engineName } from '../../../shared/engines.mjs';
import { useState, useEffect, useRef } from 'react';
import { LoaderCircle, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { launchProof, compileForEngine } from '../../lib/zk-client.js';
import { api } from '../../lib/api.js';
import { signedInputs } from '../../../shared/attestations.mjs';
import {
  validateCircuit,
  circuitHash,
  describe,
  parseProof,
  proofResult,
  publicValues,
} from '../../../shared/circuit.mjs';
export function Verify({ initial, notify }) {
  const [envelope, setEnvelope] = useState(initial),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [status, setStatus] = useState(null),
    [expected, setExpected] = useState(''),
    [sources, setSources] = useState([]),
    [verificationError, setVerificationError] = useState('');
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
    const run = ++generation.current;
    task.current?.cancel();
    setBusy(false);
    setStatus(null);
    setEnvelope(null);
    setSources([]);
    setVerificationError('');
    try {
      if (!file) return;
      if (file.size > 300000) throw Error();
      const raw = JSON.parse(await file.text());
      if (run !== generation.current) return;
      validateCircuit(raw.circuit);
      setEnvelope(parseProof(raw));
    } catch {
      if (run !== generation.current) return;
      setStatus('invalid');
      notify(
        'Fichier invalide : format, valeurs publiques ou résultat incohérents (300 Ko maximum).',
        true,
      );
    }
  };
  const verify = async () => {
    const run = ++generation.current;
    setBusy(true);
    setStatus(null);
    setSources([]);
    setVerificationError('');
    try {
      parseProof(envelope);
      const hash = await circuitHash(envelope.circuit);
      if (expected.trim() && expected.trim().toLowerCase() !== hash)
        throw Error('Le circuit ne correspond pas à l’empreinte attendue.');
      setProgress('Reconstruction du circuit public…');
      const compiled = await compileForEngine(envelope.circuit, envelope.engine);
      if (run !== generation.current) return;
      const issuers = signedInputs(envelope.circuit).length ? await api('/issuers') : undefined;
      if (run !== generation.current) return;
      task.current = launchProof(
        { mode: 'verify', envelope, compiled, ...(issuers ? { issuers } : {}) },
        setProgress,
      );
      const result = await task.current.promise;
      if (run === generation.current) {
        setStatus(result.valid ? 'valid' : 'invalid');
        setSources(result.sources ?? []);
        if (result.proofValid && !result.valid)
          setVerificationError(
            'La preuve ZK est valide, mais la provenance signée n’est pas validée. Consultez les sources ci-dessous.',
          );
      }
    } catch (e) {
      if (run === generation.current) {
        setStatus('invalid');
        setVerificationError(e.message);
        notify(e.message, true);
      }
    } finally {
      if (run === generation.current) setBusy(false);
    }
  };
  let fields = [],
    outcome = null;
  try {
    if (envelope) {
      fields = publicValues(envelope);
      outcome = proofResult(envelope);
    }
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
            <p>{envelope ? envelope.circuit.name : 'Un fichier .clair généré avec Clair'}</p>
            <Button disabled={busy} variant="secondary" onClick={() => input.current.click()}>
              {envelope ? 'Choisir un autre fichier' : 'Parcourir les fichiers'}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".clair"
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
                    ? outcome
                      ? 'La preuve confirme que la règle donne vrai.'
                      : 'La preuve confirme que la règle donne faux. La preuve est valide, la condition n’est pas satisfaite.'
                    : verificationError ||
                      'La preuve, le circuit ou les paramètres ne correspondent pas.'}
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="panel explanation">
          <h2>Ce que contient la preuve</h2>
          {envelope ? (
            <>
              <Badge>
                {signedInputs(envelope.circuit).length
                  ? envelope.privateAttestations?.length
                    ? 'Signatures privées prouvées · Noir'
                    : 'Attestations publiques jointes'
                  : 'Données déclarées · Non certifiées'}
              </Badge>
              <h3>{envelope.circuit.name}</h3>
              <p className="help">Moteur : {engineName(envelope.engine)}</p>
              <p>{envelope.circuit.description}</p>
              <div className="statement">{describe(envelope.circuit)}</div>
              <h4>{status === 'valid' ? 'Résultat prouvé' : 'Résultat annoncé — à vérifier'}</h4>
              <p>{outcome === null ? 'Indéterminé' : outcome ? 'Vrai' : 'Faux'}</p>
              <h4>Valeurs publiques</h4>
              {fields.length ? (
                fields.map((i) => (
                  <div className="public-row" key={i.id}>
                    <span>{i.label}</span>
                    <strong>{i.type === 'date' ? displayDate(i.value) : String(i.value)}</strong>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Toutes les valeurs d’entrée sont privées. Le résultat, le circuit et la provenance
                  éventuelle restent publics.
                </p>
              )}
              {signedInputs(envelope.circuit).length > 0 && (
                <>
                  <h4>Provenance des données signées</h4>
                  <p className="help">
                    Les signatures des entrées privées sont vérifiées dans le circuit ZK sans
                    révéler les valeurs. Les attestations publiques sont jointes à la preuve.
                    L’approbation et les dates sont contrôlées à chaque vérification.
                  </p>
                  {signedInputs(envelope.circuit).map((input) => {
                    const source = sources.find((s) => s.inputId === input.id);
                    return (
                      <div
                        className={
                          source && status === 'valid'
                            ? 'validation'
                            : source && !source.valid
                              ? 'validation invalid'
                              : 'notice spaced'
                        }
                        key={input.id}
                      >
                        <div>
                          <strong>
                            {input.label} · {source?.issuerName ?? input.attestation.issuerId}
                          </strong>
                          <p>
                            {!source
                              ? 'Provenance annoncée — à vérifier'
                              : source.valid && status === 'valid'
                                ? 'Origine vérifiée · Source approuvée'
                                : source.reason}
                          </p>
                          <small>
                            Champ signé : {input.attestation.claim}
                            {input.visibility === 'private' ? ' · Valeur et signature privées' : ''}
                          </small>
                          <code className="hash">{input.attestation.keyHash}</code>
                          {source && (
                            <p>Expiration : {new Date(source.expiresAt).toLocaleString('fr-FR')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
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
