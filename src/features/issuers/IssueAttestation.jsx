import { DateInput } from '../../components/DateInput.jsx';
import React, { useState, useEffect, useMemo } from 'react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { keyFingerprint } from '../../../shared/attestations.mjs';
import { circuitHash } from '../../../shared/circuit.mjs';
import { SignField, SignFields } from '../proofs/SignField.jsx';
import { fieldsForIssuer, readPublicCircuit } from './attestation-model.js';
const typeNames = { number: 'Entier positif', date: 'Date', boolean: 'Vrai / Faux' };
export function IssueAttestation({ onBack = () => {}, circuits = [] }) {
  const [issuers, setIssuers] = useState([]),
    [selected, setSelected] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [claim, setClaim] = useState(''),
    [type, setType] = useState('number'),
    [value, setValue] = useState(''),
    [results, setResults] = useState([]),
    [imported, setImported] = useState([]),
    [choice, setChoice] = useState(''),
    [values, setValues] = useState({}),
    [importing, setImporting] = useState(false),
    [circuitError, setCircuitError] = useState('');
  useEffect(() => {
    let active = true;
    api('/issuers')
      .then(async (rows) => {
        const sources = await Promise.all(
          rows.map(async (source) => ({ ...source, keyHash: await keyFingerprint(source.jwk) })),
        );
        if (active) {
          setIssuers(sources);
          setSelected(sources[0]?.id ?? '');
        }
      })
      .catch(() => {
        if (active)
          setError('Le registre des sources est indisponible. Réessayez en rouvrant cette page.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const rows = useMemo(
    () =>
      Array.from(
        new Map([...circuits, ...imported].map((row) => [row.hash ?? row.id, row])).values(),
      ),
    [circuits, imported],
  );
  const source = issuers.find((issuer) => issuer.id === selected);
  const availableRows = rows.filter((row) => fieldsForIssuer(row.schema, source).length > 0);
  const record = availableRows.find((row) => (row.hash ?? row.id) === choice);
  const fields = record && source ? fieldsForIssuer(record.schema, source) : [];
  const validClaim = /^[a-z][a-z0-9_]{0,63}$/.test(claim);
  const manualInput = source
    ? {
        id: 'issued_value',
        label: 'la donnée',
        type,
        visibility: 'public',
        source: 'signed',
        attestation: { issuerId: source.id, keyHash: source.keyHash, claim },
      }
    : null;
  function chooseCircuit(next) {
    setChoice(next);
    setValues({});
    setResults([]);
    setValue(type === 'boolean' ? false : '');
    setCircuitError('');
  }
  function changeSource(id) {
    setSelected(id);
    setChoice('');
    setCircuitError('');
    setValues({});
    setResults([]);
    setValue(type === 'boolean' ? false : '');
  }
  function fieldValue(input) {
    return values[input.id] ?? (input.type === 'boolean' ? false : '');
  }
  function valueControl(input, current, onChange, label) {
    return input.type === 'boolean' ? (
      <select
        aria-label={label}
        value={String(current)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="false">Faux</option>
        <option value="true">Vrai</option>
      </select>
    ) : input.type === 'date' ? (
      <DateInput aria-label={label} value={current} onChange={onChange} />
    ) : (
      <input
        aria-label={label}
        type="number"
        min={0}
        max={4294967295}
        step="1"
        autoComplete="off"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <>
      <PageHeading
        title="Créer une attestation"
        desc="Pour les personnes autorisées à signer : choisissez la source, sélectionnez la règle puis renseignez les informations à certifier."
        action={
          <Button variant="secondary" onClick={onBack}>
            Retour aux sources
          </Button>
        }
      />
      <section className="panel form-panel issuer-form">
        <h2>Les informations à certifier</h2>
        <p className="help">
          Une attestation est un justificatif signé. Le destinataire pourra l’importer pour créer sa
          preuve, sans recevoir votre clé privée.
        </p>
        {source && (
          <label>
            Source émettrice
            <select
              aria-label="Source émettrice"
              value={source.id}
              disabled={importing || loading || !source}
              onChange={(e) => changeSource(e.target.value)}
            >
              {issuers.map((issuer) => (
                <option key={issuer.id} value={issuer.id}>
                  {issuer.name} · {issuer.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Circuit à utiliser
          <select
            aria-label="Circuit à utiliser"
            value={choice === 'manual' || record ? choice : ''}
            onChange={(e) => chooseCircuit(e.target.value)}
            disabled={importing || loading || !source}
          >
            <option value="">Choisir un circuit</option>
            {availableRows.map((row) => (
              <option key={row.hash ?? row.id} value={row.hash ?? row.id}>
                {row.schema.name} · {(row.hash ?? row.id).slice(0, 8)}
              </option>
            ))}
            <option value="manual">Saisir un champ libre (avancé)</option>
          </select>
        </label>
        <label>
          Importer un circuit public
          <input
            aria-label="Importer un circuit public"
            type="file"
            accept=".clair"
            disabled={importing || loading || !source}
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const element = e.target;
              setImporting(true);
              setCircuitError('');
              try {
                if (file.size > 300000) throw Error('Fichier trop volumineux (300 Ko maximum).');
                const schema = readPublicCircuit(await file.text());
                if (!fieldsForIssuer(schema, source).length) {
                  setCircuitError(
                    'Ce circuit ne désigne pas cette autorité avec sa clé actuelle. Sélectionnez la source attendue avant de l’importer.',
                  );
                  return;
                }
                const hash = await circuitHash(schema),
                  row = { id: hash, hash, schema };
                setImported((current) => [...current.filter((r) => r.hash !== hash), row]);
                chooseCircuit(hash);
              } catch {
                setCircuitError(
                  'Circuit invalide : utilisez le fichier public exporté depuis l’éditeur (300 Ko maximum).',
                );
              } finally {
                element.value = '';
                setImporting(false);
              }
            }}
          />
        </label>
        <p className="help">
          Vos circuits enregistrés restent privés à votre compte. Une autorité externe peut charger
          le fichier public fourni par le demandeur, sans compte ni abonnement.
        </p>
        {circuitError && (
          <p className="validation invalid" role="alert">
            {circuitError}
          </p>
        )}
        {error && (
          <p className="validation invalid" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Chargement des sources…</p>
        ) : !source ? (
          <p className="notice">
            Aucune source approuvée disponible. Un administrateur doit d’abord enregistrer sa clé
            publique.
          </p>
        ) : (
          <>
            {!availableRows.length && (
              <p className="notice">
                Aucun circuit disponible ne désigne cette source avec sa clé actuelle. Importez un
                circuit qui lui attribue au moins un champ signé.
              </p>
            )}
            {!choice && (
              <p className="notice">
                Seuls les circuits qui désignent cette autorité sont proposés. Le formulaire affiche
                uniquement les champs qu’elle doit signer.
              </p>
            )}
            {record && (
              <>
                <p className="help">
                  Circuit : {record.schema.name}. Les noms de champs, types et clés attendues sont
                  repris automatiquement du circuit.
                </p>
                {fields.length === 0 ? (
                  <p className="notice">
                    Ce circuit ne demande aucun champ signé par cette source avec sa clé actuelle.
                    Vérifiez la source et la version du circuit ; les entrées déclarées ou destinées
                    à une autre autorité ne sont pas à signer ici.
                  </p>
                ) : (
                  <>
                    <h3>Valeurs à signer · {source.name}</h3>
                    {fields.map((input) => (
                      <label key={input.id}>
                        {input.label} · {typeNames[input.type]} ·{' '}
                        {input.visibility === 'private' ? 'privée dans la preuve' : 'publique'}
                        {valueControl(
                          input,
                          fieldValue(input),
                          (next) => {
                            setValues((current) => ({ ...current, [input.id]: next }));
                            setResults([]);
                          },
                          'Valeur pour ' + input.label + ' (' + input.id + ')',
                        )}
                        <small>Champ signé : {input.attestation.claim}</small>
                      </label>
                    ))}
                    <p className="help">
                      Une seule clé privée suffit pour signer ces {fields.length} champ(s). Un
                      fichier d’attestation sera créé pour chaque valeur.
                    </p>
                    <SignFields
                      key={choice + ':' + source.id}
                      items={fields.map((input) => ({ input, value: fieldValue(input) }))}
                      onSigned={(attestations) =>
                        setResults(
                          attestations.map((attestation, index) => ({
                            input: fields[index],
                            attestation,
                          })),
                        )
                      }
                    />
                  </>
                )}
              </>
            )}
            {choice === 'manual' && (
              <>
                <label>
                  Nom du champ signé
                  <input
                    value={claim}
                    maxLength={64}
                    onChange={(e) => {
                      setClaim(e.target.value);
                      setResults([]);
                    }}
                    placeholder="income_monthly_eur"
                  />
                </label>
                <p className="help">
                  Le destinataire devra utiliser ce même identifiant dans son circuit. Exemples :
                  birth_date, income_monthly_eur, invoice_total_cents.
                </p>
                {claim && !validClaim && (
                  <p className="help">
                    Utilisez des lettres minuscules, chiffres et underscores ; commencez par une
                    lettre.
                  </p>
                )}
                <label>
                  Type de donnée
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setValue(e.target.value === 'boolean' ? false : '');
                      setResults([]);
                    }}
                  >
                    <option value="number">Entier positif</option>
                    <option value="date">Date</option>
                    <option value="boolean">Vrai / Faux</option>
                  </select>
                </label>
                <label>
                  Valeur à attester
                  {valueControl(
                    manualInput,
                    value,
                    (next) => {
                      setValue(next);
                      setResults([]);
                    },
                    'Valeur à attester',
                  )}
                </label>
                <SignField
                  key={source.id + ':' + type + ':' + claim}
                  input={manualInput}
                  value={value}
                  disabled={!validClaim}
                  onSigned={(attestation) => setResults([{ input: manualInput, attestation }])}
                />
              </>
            )}
            {choice && (
              <p className="help">
                Les valeurs et signatures figurent dans les fichiers remis au destinataire. La clé
                privée en est exclue.
              </p>
            )}
          </>
        )}
      </section>
      {results.length > 0 && (
        <section className="panel form-panel issuer-form">
          <Badge tone="green">
            {results.length === 1 ? 'Attestation prête' : 'Attestations prêtes'}
          </Badge>
          <h2>{source?.name}</h2>
          <p>
            Les signatures ont été vérifiées localement. Remettez ces fichiers au destinataire ; il
            les importera dans sa preuve sans votre clé privée.
          </p>
          {results.map(({ input, attestation }) => (
            <div className="issuer-row" key={input.id}>
              <div>
                <strong>
                  {input.label} · {attestation.claim}
                </strong>
                <small>
                  Expiration : {new Date(attestation.expiresAt).toLocaleString('fr-FR')}
                </small>
                <details>
                  <summary>Voir le contenu de l’attestation</summary>
                  <pre>{JSON.stringify(attestation, null, 2)}</pre>
                </details>
              </div>
              <Button
                onClick={() =>
                  download(
                    attestation,
                    attestation.issuerId +
                      '-' +
                      input.id +
                      '-' +
                      attestation.claim +
                      '.attestation.clair',
                  )
                }
              >
                {results.length === 1 ? 'Télécharger l’attestation' : 'Télécharger ' + input.label}
              </Button>
            </div>
          ))}
          <p className="help">
            La source et sa période de validité seront contrôlées lors de l’utilisation.
          </p>
        </section>
      )}
    </>
  );
}
