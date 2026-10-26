import React from 'react';
import { ENGINE, engineName } from '../../../shared/engines.mjs';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { launchProof, compileForEngine } from '../../lib/zk-client.js';
import { SignField } from './SignField.jsx';
import { describe, evaluateCircuit, proofResult } from '../../../shared/circuit.mjs';
import {
  parseAttestation,
  bindEvidence,
  signedInputs,
  verifyEvidence,
} from '../../../shared/attestations.mjs';
export function Generate({ circuit: record, notify, refresh, onVerify }) {
  const c = record.schema;
  const signed = signedInputs(c);
  const [attestations, setAttestations] = useState([]),
    [imports, setImports] = useState({});
  const initial = Object.fromEntries(
    c.inputs.map((i) => {
      let value = i.type === 'boolean' ? false : '';
      if (i.id === 'cutoff' && i.type === 'date') {
        const d = new Date();
        const month = d.getUTCMonth();
        d.setUTCFullYear(d.getUTCFullYear() - 18);
        if (d.getUTCMonth() !== month) d.setUTCDate(0);
        value = d.toISOString().slice(0, 10);
      }
      return [i.id, value];
    }),
  );
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [result, setResult] = useState(null),
    [saved, setSaved] = useState(false),
    [error, setError] = useState('');
  const task = useRef(),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      task.current?.cancel();
    },
    [],
  );
  const generate = async (e) => {
    e.preventDefault();
    const run = ++generation.current;
    setBusy(true);
    setResult(null);
    setSaved(false);
    setError('');
    let authorization;
    try {
      const outcome = evaluateCircuit(c, values);
      if (c.version === 1 && !outcome)
        throw Error(
          'La règle donne faux. Ce circuit accepte uniquement vrai : ouvrez-le dans l’éditeur, choisissez « Vrai ou faux », puis enregistrez une nouvelle version.',
        );
      let issuers;
      if (signed.length) {
        issuers = await api('/issuers');
        const publicValues = Object.fromEntries(
          signed.map((i) => [i.id, i.type === 'number' ? Number(values[i.id]) : values[i.id]]),
        );
        const sources = await verifyEvidence(c, publicValues, attestations, issuers);
        const failed = sources.find((s) => !s.valid);
        if (failed) throw Error(failed.issuerName + ' : ' + failed.reason);
      }
      authorization = await api('/prover/authorize', {});
      setProgress('Préparation du circuit public…');
      const compiled = await compileForEngine(c);
      if (run !== generation.current) return;
      task.current = launchProof(
        {
          mode: 'prove',
          engine: c.engine ?? ENGINE,
          circuit: c,
          compiled,
          values,
          ...(signed.length ? { attestations, issuers } : {}),
        },
        setProgress,
      );
      const result = await task.current.promise;
      if (run !== generation.current) return;
      await api('/prover/finish', { token: authorization.token, complete: true });
      authorization = null;
      setResult(result);
      setValues(initial);
      setAttestations([]);
      setImports({});
      await refresh();
      notify('Preuve générée et vérifiée sur votre appareil.');
    } catch (e) {
      if (run === generation.current) {
        setError(e.message);
        notify(e.message, true);
      }
    } finally {
      if (authorization?.token) {
        try {
          await api('/prover/finish', { token: authorization.token, complete: false });
        } catch {
          /* Reservation expires automatically after ten minutes. */
        }
      }
      if (run === generation.current) setBusy(false);
    }
  };
  const changeValue = (input, value) => {
    setValues((current) => ({ ...current, [input.id]: value }));
    setResult(null);
    setError('');
    if (input.source === 'signed') {
      setAttestations((current) => current.filter((item) => item.inputId !== input.id));
      setImports((current) => ({ ...current, [input.id]: '' }));
    }
  };
  const importAttestation = (input, text) => {
    setResult(null);
    setError('');
    setImports((current) => ({ ...current, [input.id]: text }));
    setAttestations((current) => current.filter((item) => item.inputId !== input.id));
    setValues((current) => ({ ...current, [input.id]: input.type === 'boolean' ? false : '' }));
    if (!text.trim()) return;
    try {
      if (text.length > 12000) throw Error('Attestation trop volumineuse (12 Ko maximum).');
      const a = parseAttestation(JSON.parse(text)),
        evidence = { inputId: input.id, attestation: a };
      bindEvidence({ inputs: [input] }, { [input.id]: a.value }, [evidence]);
      setAttestations((current) => [
        ...current.filter((item) => item.inputId !== input.id),
        evidence,
      ]);
      setValues((current) => ({ ...current, [input.id]: a.value }));
    } catch {
      setError(
        input.label +
          ' : attestation invalide ou incompatible avec la source, la clé, le champ ou le type attendu.',
      );
    }
  };
  return (
    <>
      <PageHeading
        title="Générer une preuve"
        desc="Vos données privées sont utilisées uniquement sur cet appareil."
      />
      <div className="generate-layout">
        <section className="panel form-panel">
          <div className="panel-title">
            <h2>{c.name}</h2>
            <Badge>{signed.length ? 'Attestations requises' : 'Données déclarées'}</Badge>
          </div>
          <p className="help">{c.description}</p>
          <p className="help">Moteur : {engineName(c.engine)}</p>
          <p className="help">
            {c.version === 2
              ? 'Le résultat vrai ou faux sera public. Les valeurs marquées privées ne seront pas partagées.'
              : 'Ce circuit historique exige un résultat vrai. Vous pouvez changer ce mode dans l’éditeur.'}
          </p>
          <form onSubmit={generate} noValidate>
            {error && (
              <div className="validation invalid" role="alert">
                <p>{error}</p>
              </div>
            )}
            {c.inputs.map((i) => (
              <div key={i.id}>
                {i.source === 'signed' && (
                  <div className="notice spaced">
                    <div>
                      <strong>
                        {attestations.some((item) => item.inputId === i.id)
                          ? 'Attestation chargée'
                          : 'Attestation requise'}{' '}
                        · {i.attestation.issuerId}
                      </strong>
                      <p>
                        Importez le fichier fourni par cette source pour {i.label}. Vous n’avez pas
                        besoin de sa clé privée.
                      </p>
                      <p className="help">
                        Champ attendu : {i.attestation.claim}. La valeur sera remplie
                        automatiquement.
                        {i.visibility === 'private'
                          ? ' La valeur et la signature resteront privées et seront vérifiées dans le circuit Noir. La source et les dates seront publiques.'
                          : ' La signature et la source seront vérifiées avant la génération.'}
                      </p>
                      <label>
                        Importer l’attestation pour {i.label}
                        <input
                          aria-label={'Importer l’attestation pour ' + i.label}
                          disabled={busy}
                          type="file"
                          accept=".clair"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const element = e.target;
                            importAttestation(i, '');
                            try {
                              if (file.size > 12000)
                                throw Error('Attestation trop volumineuse (12 Ko maximum).');
                              importAttestation(i, await file.text());
                            } catch (e) {
                              setError(e.message);
                            } finally {
                              element.value = '';
                            }
                          }}
                        />
                      </label>
                      <details>
                        <summary>Coller une attestation JSON</summary>
                        <label>
                          Attestation pour {i.label}
                          <textarea
                            aria-label={'Attestation pour ' + i.label}
                            disabled={busy}
                            value={imports[i.id] ?? ''}
                            onChange={(e) => importAttestation(i, e.target.value)}
                            placeholder="Collez le JSON signé"
                          />
                        </label>
                      </details>
                    </div>
                  </div>
                )}
                <label>
                  <span className="field-label">
                    {i.label}
                    <Badge tone={i.visibility === 'private' ? 'green' : ''}>
                      {i.visibility === 'private' ? <LockKeyhole size={11} /> : null}
                      {i.visibility === 'private' ? 'Privée' : 'Publique'}
                    </Badge>
                  </span>
                  {i.type === 'boolean' ? (
                    <select
                      aria-label={i.label}
                      value={String(values[i.id])}
                      onChange={(e) => changeValue(i, e.target.value === 'true')}
                      disabled={busy}
                    >
                      <option value="false">Faux</option>
                      <option value="true">Vrai</option>
                    </select>
                  ) : (
                    <input
                      aria-label={i.label}
                      required
                      type={i.type === 'date' ? 'date' : 'number'}
                      min={i.type === 'date' ? '1900-01-01' : 0}
                      max={i.type === 'date' ? '2199-12-31' : 4294967295}
                      step={1}
                      autoComplete="off"
                      value={values[i.id]}
                      disabled={busy}
                      onChange={(e) => changeValue(i, e.target.value)}
                    />
                  )}
                  <small>
                    {i.source === 'signed'
                      ? 'Valeur renseignée par l’attestation. La modifier nécessite une nouvelle attestation ou signature.'
                      : i.visibility === 'private'
                        ? 'Cette valeur ne sera pas incluse dans le fichier de preuve.'
                        : 'Cette valeur sera visible par toute personne recevant la preuve.'}
                  </small>
                </label>
                {i.source === 'signed' && (
                  <details>
                    <summary>Signer manuellement avec une clé privée</summary>
                    <p className="help">
                      Si vous émettez vous-même cette donnée, saisissez sa valeur ci-dessus puis
                      utilisez la clé privée de la source.
                    </p>
                    <SignField
                      key={result ? 'completed' : 'editing'}
                      input={i}
                      value={values[i.id]}
                      disabled={busy}
                      onSigned={(a) => importAttestation(i, JSON.stringify(a, null, 2))}
                    />
                  </details>
                )}
              </div>
            ))}
            <Button variant="full" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="spin" /> : <Fingerprint size={18} />}
              Générer ma preuve
            </Button>
            {busy && (
              <div className="progress" role="status">
                <span>{progress}</span>
                <button
                  type="button"
                  className="text-link dark"
                  onClick={() => {
                    generation.current++;
                    task.current?.cancel();
                    setBusy(false);
                    setProgress('');
                  }}
                >
                  Annuler
                </button>
              </div>
            )}
          </form>
        </section>
        <aside>
          <section className="panel explanation">
            <span className="template-icon sage">
              <ShieldCheck size={24} />
            </span>
            <h3>Ce que vous allez démontrer</h3>
            <p className="statement">{describe(c)}</p>
            {[
              'Le circuit est public et consultable.',
              'Les valeurs privées restent locales.',
              'La preuve est téléchargeable et réutilisable.',
            ].map((s) => (
              <div className="info-line" key={s}>
                <Check size={16} />
                <span>{s}</span>
              </div>
            ))}
            <div className="notice">
              {signed.length
                ? 'Les attestations seront vérifiées avec les clés approuvées. Les valeurs et signatures des entrées signées privées restent locales. Les autres valeurs restent déclarées. Cela ne prouve pas l’identité du porteur.'
                : 'Les valeurs sont déclarées par vous. Cette preuve ne certifie ni leur origine, ni votre identité.'}
            </div>
          </section>
          {result && (
            <section className="panel result-panel">
              <Badge tone="green">
                <Check size={13} />
                Preuve prête
              </Badge>
              <h3>Résultat prouvé : {proofResult(result) ? 'Vrai' : 'Faux'}</h3>
              <p>
                La preuve est valide : elle atteste ce résultat, sans révéler les entrées privées.
              </p>
              <p>Les champs privés du formulaire ont été effacés.</p>
              <Button variant="full" onClick={() => download(result, c.name + '.preuve.clair')}>
                <Download size={16} />
                Télécharger la preuve
              </Button>
              <Button
                variant="secondary full"
                disabled={saved}
                onClick={async () => {
                  try {
                    await api('/proofs', result);
                    setSaved(true);
                    await refresh();
                    notify('Preuve enregistrée dans votre espace.');
                  } catch (e) {
                    notify(e.message, true);
                  }
                }}
              >
                <Save size={16} />
                {saved ? 'Enregistrée' : 'Enregistrer dans mon espace'}
              </Button>
              <button className="text-link dark" onClick={() => onVerify(result)}>
                Ouvrir la vérification <ArrowRight size={15} />
              </button>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
