import React from 'react';
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
import { describe, validateInputs } from '../../../shared/circuit.mjs';
export function Generate({ circuit: record, notify, refresh, onVerify }) {
  const c = record.schema;
  const initial = Object.fromEntries(
    c.inputs.map((i) => {
      let value = i.type === 'boolean' ? false : '';
      if (i.id === 'cutoff') {
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
    [saved, setSaved] = useState(false);
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
    try {
      validateInputs(c, values);
      await api('/prover/authorize', {});
      setProgress('Préparation du circuit public…');
      const compiled = await compileForEngine(c);
      if (run !== generation.current) return;
      task.current = launchProof({ mode: 'prove', circuit: c, compiled, values }, setProgress);
      const result = await task.current.promise;
      if (run !== generation.current) return;
      setResult(result);
      setValues(initial);
      notify('Preuve générée et vérifiée sur votre appareil.');
    } catch (e) {
      if (run === generation.current) notify(e.message, true);
    } finally {
      if (run === generation.current) setBusy(false);
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
            <Badge>Données déclarées</Badge>
          </div>
          <p className="help">{c.description}</p>
          <form onSubmit={generate}>
            {c.inputs.map((i) => (
              <label key={i.id}>
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
                    onChange={(e) => setValues({ ...values, [i.id]: e.target.value === 'true' })}
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
                    onChange={(e) => setValues({ ...values, [i.id]: e.target.value })}
                  />
                )}
                <small>
                  {i.visibility === 'private'
                    ? 'Cette valeur ne sera pas incluse dans le fichier de preuve.'
                    : 'Cette valeur sera visible par toute personne recevant la preuve.'}
                </small>
              </label>
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
              Les valeurs sont déclarées par vous. Cette preuve ne certifie ni leur origine, ni
              votre identité.
            </div>
          </section>
          {result && (
            <section className="panel result-panel">
              <Badge tone="green">
                <Check size={13} />
                Preuve prête
              </Badge>
              <h3>Juste la preuve. Rien de plus.</h3>
              <p>Les champs privés du formulaire ont été effacés.</p>
              <Button variant="full" onClick={() => download(result, c.name + '.clair.json')}>
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
