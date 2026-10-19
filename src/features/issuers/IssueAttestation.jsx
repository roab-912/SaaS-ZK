import React, { useState, useEffect } from 'react';
import { Badge, Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { keyFingerprint } from '../../../shared/attestations.mjs';
import { SignField } from '../proofs/SignField.jsx';
export function IssueAttestation({ onBack = () => {} }) {
  const [issuers, setIssuers] = useState([]),
    [selected, setSelected] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [claim, setClaim] = useState(''),
    [type, setType] = useState('number'),
    [value, setValue] = useState(''),
    [result, setResult] = useState(null);
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
  const source = issuers.find((i) => i.id === selected);
  const validClaim = /^[a-z][a-z0-9_]{0,63}$/.test(claim);
  const input = source
    ? {
        id: 'issued_value',
        label: 'la donnée',
        type,
        visibility: 'public',
        source: 'signed',
        attestation: { issuerId: source.id, keyHash: source.keyHash, claim },
      }
    : null;
  return (
    <>
      <PageHeading
        title="Créer une attestation"
        desc="Signez une donnée et fournissez son fichier à son destinataire, sans créer de preuve ZK."
        action={
          <Button variant="secondary" onClick={onBack}>
            Retour aux sources
          </Button>
        }
      />
      <section className="panel form-panel issuer-form">
        <h2>Émettre une donnée signée</h2>
        <p className="help">
          Accessible sans compte ni abonnement. La clé privée de la source est nécessaire pour
          signer. Un fichier atteste une donnée ; répétez l’opération pour plusieurs champs.
        </p>
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
            <label>
              Source émettrice
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setResult(null);
                }}
              >
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nom du champ signé
              <input
                value={claim}
                maxLength={64}
                onChange={(e) => {
                  setClaim(e.target.value);
                  setResult(null);
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
                Utilisez des lettres minuscules, chiffres et underscores ; commencez par une lettre.
              </p>
            )}
            <label>
              Type de donnée
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setValue(e.target.value === 'boolean' ? false : '');
                  setResult(null);
                }}
              >
                <option value="number">Entier positif</option>
                <option value="date">Date</option>
                <option value="boolean">Vrai / Faux</option>
              </select>
            </label>
            <label>
              Valeur à attester
              {type === 'boolean' ? (
                <select
                  aria-label="Valeur à attester"
                  value={String(value)}
                  onChange={(e) => {
                    setValue(e.target.value === 'true');
                    setResult(null);
                  }}
                >
                  <option value="false">Faux</option>
                  <option value="true">Vrai</option>
                </select>
              ) : (
                <input
                  aria-label="Valeur à attester"
                  type={type === 'date' ? 'date' : 'number'}
                  min={type === 'date' ? '1900-01-01' : 0}
                  max={type === 'date' ? '2199-12-31' : 4294967295}
                  step="1"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setResult(null);
                  }}
                />
              )}
            </label>
            <p className="help">
              La valeur et la signature figurent dans le fichier remis au destinataire. La clé
              privée en est exclue.
            </p>
            <SignField
              key={selected + ':' + type + ':' + claim}
              input={input}
              value={value}
              disabled={!validClaim}
              onSigned={setResult}
            />
          </>
        )}
      </section>
      {result && (
        <section className="panel form-panel issuer-form">
          <Badge tone="green">Attestation prête</Badge>
          <h2>
            {source?.name} · {result.claim}
          </h2>
          <p>
            La signature a été vérifiée localement. Le destinataire pourra importer ce fichier dans
            « Générer une preuve » ; il n’aura pas besoin de votre clé privée.
          </p>
          <p className="help">
            Expiration : {new Date(result.expiresAt).toLocaleString('fr-FR')}. La source et sa
            période de validité seront contrôlées lors de l’utilisation.
          </p>
          <Button
            onClick={() =>
              download(result, result.issuerId + '-' + result.claim + '.attestation.clair.json')
            }
          >
            Télécharger l’attestation
          </Button>
          <details>
            <summary>Voir le contenu de l’attestation</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}
    </>
  );
}
