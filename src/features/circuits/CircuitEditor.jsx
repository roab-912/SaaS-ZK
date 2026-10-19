import React from 'react';
import { ENGINE, ZK_ENGINES } from '../../../shared/engines.mjs';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { keyFingerprint } from '../../../shared/attestations.mjs';
import {
  ArrowRight,
  Braces,
  Check,
  CircleHelp,
  GitBranch,
  LockKeyhole,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { ref, constant, comparison, removeInput } from './editor-model.js';
import { validateCircuit, describe, ops, validationMessage } from '../../../shared/circuit.mjs';
export function Editor({ draft: c, setDraft, onSave }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const [issuers, setIssuers] = useState([]),
    [sourceError, setSourceError] = useState('');
  useEffect(() => {
    let active = true;
    api('/issuers')
      .then(async (rows) => {
        const sources = await Promise.all(
          rows.map(async (i) => ({ ...i, keyHash: await keyFingerprint(i.jwk) })),
        );
        if (active) setIssuers(sources);
      })
      .catch(() => {
        if (active)
          setSourceError(
            'Registre indisponible : impossible de sélectionner une source pour le moment.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  let error = '';
  try {
    validateCircuit(c);
  } catch (e) {
    error = validationMessage(e);
  }
  const update = (key, value) => setDraft({ ...c, [key]: value });
  const updateInput = (index, patch) =>
    update(
      'inputs',
      c.inputs.map((i, n) => {
        if (n !== index) return i;
        const next = { ...i, ...patch };
        if (next.attestation === null) delete next.attestation;
        return next;
      }),
    );
  const save = async (go) => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(go);
    } catch (e) {
      setSaveError(validationMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Construire une règle"
        desc="Construisez une règle et prouvez son résultat sans révéler vos données privées."
        action={
          <div className="row-actions">
            <Button
              variant="secondary"
              disabled={!!error || saving}
              onClick={() => download(validateCircuit(c), c.name + '.circuit.clair.json')}
            >
              Exporter le circuit public
            </Button>
            <Button variant="secondary" disabled={!!error || saving} onClick={() => save(false)}>
              <Save size={17} />
              Enregistrer
            </Button>
            <Button disabled={!!error || saving} onClick={() => save(true)}>
              Enregistrer et prouver <ArrowRight size={17} />
            </Button>
          </div>
        }
      />
      {saveError && (
        <div className="validation invalid" role="alert">
          <CircleHelp size={19} />
          <p>{saveError}</p>
        </div>
      )}
      {editNotice && (
        <p className="help" role="status">
          {editNotice}
        </p>
      )}
      <div className="editor-meta panel">
        <label>
          Nom du circuit
          <input maxLength={80} value={c.name} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label>
          Description
          <input
            maxLength={500}
            value={c.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
      </div>
      <section className="panel form-panel" style={{ marginBottom: 20 }}>
        <label>
          Résultat à prouver
          <select
            value={String(c.version)}
            onChange={(e) => update('version', Number(e.target.value))}
          >
            <option value="2">Vrai ou faux — publier le résultat</option>
            <option value="1">Vrai uniquement — condition obligatoire</option>
          </select>
        </label>
        <p className="help">
          {c.version === 2
            ? 'Une preuve valide peut démontrer que la règle est vraie ou fausse. Ce résultat sera public, même si toutes les entrées sont privées.'
            : 'Ce mode historique refuse une preuve lorsque la règle est fausse. Choisissez « Vrai ou faux » pour prouver les deux résultats.'}
        </p>
        <label>
          Moteur de preuve
          <select value={c.engine ?? ENGINE} onChange={(e) => update('engine', e.target.value)}>
            {ZK_ENGINES.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.name}
                {engine.experimental ? ' · Expérimental' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="help">
          {ZK_ENGINES.find((engine) => engine.id === (c.engine ?? ENGINE))?.description}
        </p>
        <p className="help">
          Le moteur est conservé avec cette version du circuit. Vos données privées restent sur
          votre appareil.
        </p>
      </section>
      <div className="editor-layout">
        <aside className="panel input-panel">
          <div className="panel-title">
            <h2>
              <span className="step">1</span>Les entrées
            </h2>
            <Badge>{c.inputs.length}/12</Badge>
          </div>
          <p className="help">
            Choisissez ce qui restera privé et ce qui sera partagé avec la preuve.
          </p>
          {c.inputs.map((i, n) => (
            <div className="input-block" key={n}>
              <div className="input-block-title">
                <LockKeyhole size={15} />
                <code>{i.id}</code>
                <button
                  className="icon-button"
                  aria-label={'Supprimer l’entrée ' + i.label}
                  disabled={c.inputs.length <= 1}
                  title={c.inputs.length <= 1 ? 'Conservez au moins une entrée.' : undefined}
                  onClick={() => {
                    const next = removeInput(c, i.id);
                    const replacement =
                      next.inputs.find((input) => input.type === i.type) ?? next.inputs[0];
                    setDraft(next);
                    setEditNotice(
                      i.label +
                        ' a été supprimée. Ses références utilisent désormais ' +
                        replacement.label +
                        '.',
                    );
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <label>
                Libellé
                <input
                  value={i.label}
                  maxLength={60}
                  onChange={(e) => updateInput(n, { label: e.target.value })}
                />
              </label>
              <div className="two-fields">
                <label>
                  Type
                  <select value={i.type} onChange={(e) => updateInput(n, { type: e.target.value })}>
                    <option value="number">Entier positif</option>
                    <option value="date">Date</option>
                    <option value="boolean">Vrai / Faux</option>
                  </select>
                </label>
                <label>
                  Visibilité
                  <select
                    value={i.visibility}
                    disabled={i.source === 'signed'}
                    onChange={(e) => updateInput(n, { visibility: e.target.value })}
                  >
                    <option value="private">Privée</option>
                    <option value="public">Publique</option>
                  </select>
                </label>
              </div>
              <label>
                Source de cette entrée
                <select
                  aria-label={'Source de ' + i.label}
                  value={
                    i.source === 'signed' ? 'issuer:' + (i.attestation?.issuerId ?? '') : 'declared'
                  }
                  onChange={(e) => {
                    if (e.target.value === 'declared')
                      return updateInput(n, { source: 'declared', attestation: null });
                    const issuer = issuers.find(
                      (source) => 'issuer:' + source.id === e.target.value,
                    );
                    if (issuer)
                      updateInput(n, {
                        source: 'signed',
                        visibility: 'public',
                        attestation: { issuerId: issuer.id, keyHash: issuer.keyHash, claim: i.id },
                      });
                  }}
                >
                  <option value="declared">Déclaration de l’utilisateur</option>
                  {i.source === 'signed' &&
                    !issuers.some((source) => source.id === i.attestation?.issuerId) && (
                      <option value={'issuer:' + i.attestation?.issuerId}>
                        Source indisponible : {i.attestation?.issuerId}
                      </option>
                    )}
                  {issuers.map((source) => (
                    <option
                      key={source.id}
                      value={'issuer:' + source.id}
                      disabled={c.version !== 2}
                    >
                      {source.name} — signée, valeur publique
                    </option>
                  ))}
                </select>
              </label>
              {sourceError && <small className="help">{sourceError}</small>}
              {i.source === 'signed' && (
                <>
                  <label>
                    Champ signé attendu
                    <input
                      aria-label={'Champ signé pour ' + i.label}
                      maxLength={64}
                      value={i.attestation.claim}
                      onChange={(e) =>
                        updateInput(n, { attestation: { ...i.attestation, claim: e.target.value } })
                      }
                    />
                  </label>
                  <small className="help">
                    Cette valeur et son attestation seront publiques. La clé attendue est figée dans
                    cette version du circuit.
                  </small>
                  <code className="hash">{i.attestation.keyHash}</code>
                </>
              )}
            </div>
          ))}
          <Button
            variant="secondary full"
            disabled={c.inputs.length >= 12}
            onClick={() => {
              let n = c.inputs.length + 1;
              while (c.inputs.some((i) => i.id === 'value_' + n)) n++;
              update('inputs', [
                ...c.inputs,
                {
                  id: 'value_' + n,
                  label: 'Valeur ' + n,
                  type: 'number',
                  visibility: 'private',
                  source: 'declared',
                },
              ]);
            }}
          >
            <Plus size={16} />
            Ajouter une entrée
          </Button>
        </aside>
        <div className="panel logic-panel">
          <div className="panel-title">
            <h2>
              <span className="step">2</span>La logique
            </h2>
            <Badge>
              <GitBranch size={12} />
              Arbre de conditions
            </Badge>
          </div>
          <p className="help">
            Imbriquez les blocs pour combiner vos conditions. Le bloc final produit un résultat vrai
            ou faux.
          </p>
          <div className="tree-canvas">
            <div className="root-marker">
              <Check size={14} /> CONDITION À DÉMONTRER
            </div>
            <NodeEditor
              node={c.root}
              inputs={c.inputs}
              onChange={(root) => update('root', root)}
              depth={0}
            />
          </div>
        </div>
      </div>
      <div className={'validation ' + (error ? 'invalid' : '')} role="status">
        {error ? <CircleHelp size={19} /> : <Check size={19} />}
        <div>
          <strong>{error ? 'Ajustez votre règle' : 'Votre règle est prête'}</strong>
          <p>{error || describe(c)}</p>
        </div>
      </div>
      <p className="help">
        Limites : 64 blocs, 10 niveaux, listes de 32 valeurs. Entiers de 0 à 4 294 967 295 ;
        division entière. Les dépassements et divisions par zéro empêchent la preuve.
      </p>
    </>
  );
}
function NodeEditor({ node: n, inputs, onChange, depth }) {
  const selection = n.kind === 'op' ? n.op : n.kind;
  const choose = (key) => {
    if (key === 'input') return onChange(ref(inputs[0]?.id || 'value'));
    if (key === 'constant') return onChange(constant());
    if (key === 'in')
      return onChange({ kind: 'in', value: ref(inputs[0]?.id || 'value'), values: [1, 2, 3] });
    const groups = [
      ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
      ['add', 'sub', 'mul', 'div', 'mod'],
      ['and', 'or', 'xor'],
    ];
    if (n.kind === 'op' && groups.some((group) => group.includes(n.op) && group.includes(key)))
      return onChange({ ...n, op: key });
    let args = ['and', 'or', 'xor', 'not'].includes(key)
      ? [comparison(inputs), comparison(inputs)]
      : comparison(inputs).args;
    if (key === 'not') args = args.slice(0, 1);
    onChange({ kind: 'op', op: key, args });
  };
  return (
    <div className={'tree-node depth-' + (depth % 3)}>
      <div className="node-head">
        <span
          className={
            'node-type ' +
            (n.kind === 'op' && ['and', 'or', 'xor', 'not'].includes(n.op) ? 'logical' : '')
          }
        >
          <Braces size={14} />
        </span>
        <select
          aria-label={'Bloc niveau ' + depth}
          value={selection}
          onChange={(e) => choose(e.target.value)}
        >
          <optgroup label="Valeurs">
            <option value="input">Entrée</option>
            <option value="constant">Valeur fixe</option>
          </optgroup>
          <optgroup label="Conditions">
            {['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].map((k) => (
              <option key={k} value={k}>
                {ops[k]}
              </option>
            ))}
            <option value="in">Présent dans une liste</option>
          </optgroup>
          <optgroup label="Logique">
            {['and', 'or', 'xor', 'not'].map((k) => (
              <option key={k} value={k}>
                {ops[k]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Calculs">
            {['add', 'sub', 'mul', 'div', 'mod'].map((k) => (
              <option key={k} value={k}>
                {ops[k]}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {n.kind === 'input' && (
        <select
          aria-label="Entrée utilisée"
          value={n.id}
          onChange={(e) => onChange({ ...n, id: e.target.value })}
        >
          {!inputs.some((input) => input.id === n.id) && (
            <option value={n.id}>Choisir une entrée — référence absente : {n.id}</option>
          )}
          {inputs.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label} · {i.visibility === 'private' ? 'privée' : 'publique'}
            </option>
          ))}
        </select>
      )}
      {n.kind === 'constant' && (
        <div className="constant-fields">
          <select
            aria-label="Type de valeur fixe"
            value={n.type}
            onChange={(e) =>
              onChange({
                ...n,
                type: e.target.value,
                value:
                  e.target.value === 'boolean' ? true : e.target.value === 'date' ? 20000101 : 18,
              })
            }
          >
            <option value="number">Nombre</option>
            <option value="date">Date</option>
            <option value="boolean">Booléen</option>
          </select>
          {n.type === 'boolean' ? (
            <select
              aria-label="Valeur fixe"
              value={String(n.value)}
              onChange={(e) => onChange({ ...n, value: e.target.value === 'true' })}
            >
              <option value="true">Vrai</option>
              <option value="false">Faux</option>
            </select>
          ) : (
            <input
              aria-label="Valeur fixe"
              type={n.type === 'date' ? 'date' : 'number'}
              min={n.type === 'date' ? '1900-01-01' : 0}
              max={n.type === 'date' ? '2199-12-31' : 4294967295}
              value={
                n.type === 'date'
                  ? String(n.value).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
                  : n.value
              }
              onChange={(e) =>
                onChange({ ...n, value: Number(e.target.value.replaceAll('-', '')) })
              }
            />
          )}
        </div>
      )}
      {n.kind === 'op' && (
        <div className="branches">
          {n.args.map((arg, index) => (
            <div className="branch" key={index}>
              <span className="branch-label">
                {n.args.length === 1 ? 'CONDITION' : index === 0 ? 'A' : 'B'}
              </span>
              {depth < 10 ? (
                <NodeEditor
                  node={arg}
                  inputs={inputs}
                  depth={depth + 1}
                  onChange={(child) =>
                    onChange({ ...n, args: n.args.map((a, j) => (j === index ? child : a)) })
                  }
                />
              ) : (
                <p>Profondeur maximale atteinte.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {n.kind === 'in' && (
        <div className="branches">
          {depth < 10 && (
            <NodeEditor
              node={n.value}
              inputs={inputs}
              depth={depth + 1}
              onChange={(value) => onChange({ ...n, value })}
            />
          )}
          <ListValues values={n.values} onChange={(values) => onChange({ ...n, values })} />
        </div>
      )}
    </div>
  );
}
function ListValues({ values, onChange }) {
  const [text, setText] = useState(values.join(', '));
  return (
    <label>
      Valeurs autorisées (séparées par une virgule)
      <input
        aria-label="Valeurs de la liste"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value.split(',').map((s) => (s.trim() === '' ? NaN : Number(s.trim()))),
          );
        }}
      />
    </label>
  );
}
