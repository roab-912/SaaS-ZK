import React from 'react';
import { useState } from 'react';
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
import { ref, constant, comparison } from './editor-model.js';
import { validateCircuit, describe, ops } from '../../../shared/circuit.mjs';
export function Editor({ draft: c, setDraft, onSave }) {
  const [saving, setSaving] = useState(false);
  let error = '';
  try {
    validateCircuit(c);
  } catch (e) {
    error = e.issues ? 'Complétez les entrées et les blocs.' : e.message;
  }
  const update = (key, value) => setDraft({ ...c, [key]: value });
  const updateInput = (index, patch) =>
    update(
      'inputs',
      c.inputs.map((i, n) => (n === index ? { ...i, ...patch } : i)),
    );
  const save = async (go) => {
    setSaving(true);
    try {
      await onSave(go);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Construire une règle"
        desc="Des entrées, des conditions, et une seule conclusion : vrai."
        action={
          <div className="row-actions">
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
                  onClick={() =>
                    update(
                      'inputs',
                      c.inputs.filter((_, x) => x !== n),
                    )
                  }
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
                    onChange={(e) => updateInput(n, { visibility: e.target.value })}
                  >
                    <option value="private">Privée</option>
                    <option value="public">Publique</option>
                  </select>
                </label>
              </div>
              <small className="muted">Source : déclaration de l’utilisateur</small>
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
            Imbriquez les blocs pour combiner vos conditions. Le bloc final doit être vrai.
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
    let args = ['and', 'or', 'xor', 'not'].includes(key)
      ? [comparison(inputs), comparison(inputs)]
      : [ref(inputs[0]?.id || 'value'), constant()];
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
