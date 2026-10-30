import React, { useState, useEffect } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { keyFingerprint } from '../../../shared/attestations.mjs';
export function Issuers({
  user,
  notify,
  onCreateAttestation = () => {},
  onVatAuthority = () => {},
}) {
  const [issuers, setIssuers] = useState([]),
    [name, setName] = useState(''),
    [id, setId] = useState(''),
    [jwk, setJwk] = useState(''),
    [approved, setApproved] = useState(true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [offline, setOffline] = useState(null);
  const refresh = () =>
    api('/issuers').then(async (rows) =>
      setIssuers(
        await Promise.all(rows.map(async (i) => ({ ...i, keyHash: await keyFingerprint(i.jwk) }))),
      ),
    );
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    let active = true;
    api('/offline-verifier/status')
      .then((status) => {
        if (active) setOffline(status);
      })
      .catch(() => {
        if (active) setOffline({ available: false });
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <PageHeading
        title="Sources de confiance"
        desc="Les sources approuvées disponibles pour signer les entrées de vos circuits."
        action={
          <div className="row-actions">
            <Button variant="secondary" onClick={onVatAuthority}>
              Certifier des factures
            </Button>
            <Button onClick={onCreateAttestation}>Créer une attestation</Button>
          </div>
        }
      />
      {error && (
        <div className="validation invalid" role="alert">
          {error}
        </div>
      )}
      <section className="panel form-panel">
        <div className="row-actions source-downloads">
          <h2>Sources disponibles</h2>
          {offline?.available && (
            <a className="button secondary" href="/api/offline-verifier" download>
              Télécharger le vérificateur hors ligne
            </a>
          )}
        </div>
        <p className="help">
          {offline?.available
            ? 'Logiciel portable Windows 64 bits · ' +
              Math.ceil(offline.bytes / 1048576) +
              ' Mio environ. Extrayez l’archive ZIP puis lancez demarrer.cmd. Aucune installation ni connexion Internet nécessaire.'
            : 'Le téléchargement du vérificateur Windows sera disponible une fois sa préparation terminée.'}
        </p>
        <p className="help">
          Le logiciel inclut un instantané des clés publiques approuvées. Hors ligne, les
          révocations et changements de clés ultérieurs ne sont pas connus. Retéléchargez-le pour
          actualiser les sources.
        </p>
        {issuers.length ? (
          issuers.map((i) => (
            <div className="issuer-row" key={i.id}>
              <BadgeCheck />
              <div>
                <strong>{i.name}</strong>
                <small>{i.id}</small>
                <details>
                  <summary>Voir la clé publique</summary>
                  <pre>{JSON.stringify(i.jwk, null, 2)}</pre>
                  <code className="hash">{i.keyHash}</code>
                </details>
              </div>
              <Badge>Approuvée</Badge>
              {offline?.available && (
                <a
                  className="button secondary"
                  href={'/api/offline-verifier?issuer=' + encodeURIComponent(i.id)}
                  download
                  aria-label={'Télécharger le vérificateur pour ' + i.name}
                >
                  Vérificateur hors ligne
                </a>
              )}
              {user?.admin && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setId(i.id);
                    setName(i.name);
                    setJwk(JSON.stringify(i.jwk, null, 2));
                    setApproved(true);
                    setError('');
                  }}
                >
                  Modifier
                </Button>
              )}
            </div>
          ))
        ) : (
          <Empty icon={BadgeCheck} title="Aucune source disponible">
            {user?.admin
              ? 'Ajoutez une source avec sa clé publique pour commencer.'
              : 'Un administrateur peut ajouter des sources avec leur clé publique.'}
          </Empty>
        )}
        <article
          className="issuer-row source-preview"
          aria-label="FranceConnect — à venir"
          aria-disabled="true"
        >
          <BadgeCheck aria-hidden="true" />
          <div>
            <strong>FranceConnect</strong>
            <small>À venir · Connexion indisponible</small>
            <p className="help">
              Aperçu : connecter une identité numérique et utiliser les attributs autorisés dans un
              parcours d’attestation et de preuve. Ce module reste à développer.
            </p>
          </div>
          <Badge>Bientôt</Badge>
        </article>
      </section>
      {user?.admin && (
        <section className="panel form-panel issuer-form">
          <h2>Ajouter ou modifier une source</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setSaving(true);
              try {
                let key;
                try {
                  key = JSON.parse(jwk);
                } catch {
                  throw Error('La clé publique doit être un objet JSON au format JWK.');
                }
                await api('/issuers', { id, name, jwk: key, approved });
                await refresh();
                notify('Registre mis à jour.');
              } catch (e) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              Identifiant
              <input
                required
                maxLength={40}
                pattern="[a-z0-9-]{1,40}"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
            <label>
              Nom
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Clé publique P-256 (JWK)
              <textarea
                required
                value={jwk}
                onChange={(e) => setJwk(e.target.value)}
                placeholder='{"kty":"EC","crv":"P-256","x":"…","y":"…"}'
              />
            </label>
            <label>
              Statut
              <select
                value={String(approved)}
                onChange={(e) => setApproved(e.target.value === 'true')}
              >
                <option value="true">Approuvée</option>
                <option value="false">Révoquée</option>
              </select>
            </label>
            <p className="help">
              L’émetteur peut créer une attestation depuis la page dédiée et remettre son fichier au
              destinataire. Révoquer une source ou remplacer sa clé retire l’approbation de ses
              anciennes attestations.
            </p>
            <Button disabled={saving}>Enregistrer la source</Button>
          </form>
        </section>
      )}
    </>
  );
}
