import { CopyButton } from '../../components/CopyButton.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ConfirmationDialog } from '../../components/ConfirmationDialog.jsx';
import { matchesSearch } from '../../lib/search.js';
import { date } from '../../lib/format.js';
import React, { useState, useEffect } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { keyFingerprint, publicKeySchema } from '../../../shared/attestations.mjs';
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
    [offline, setOffline] = useState(null),
    [query, setQuery] = useState(''),
    [checkedAt, setCheckedAt] = useState(null),
    [pendingSource, setPendingSource] = useState(null);
  const refresh = () =>
    api('/issuers')
      .then(async (rows) =>
        setIssuers(
          await Promise.all(
            rows.map(async (i) => ({ ...i, keyHash: await keyFingerprint(i.jwk) })),
          ),
        ),
      )
      .then(() => setCheckedAt(new Date().toISOString()));
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
  const visible = issuers.filter((i) => matchesSearch(query, i.name, i.id, i.keyHash));
  async function saveSource(payload) {
    await api('/issuers', payload);
    await refresh();
    notify('Registre mis à jour.');
  }
  return (
    <>
      <PageHeading
        title="Sources de confiance"
        desc="Une source de confiance signe vos informations pour en certifier l’origine. Retrouvez ici les sources approuvées et leurs outils de signature."
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
        {checkedAt && (
          <p className="help">
            Registre consulté le <time dateTime={checkedAt}>{date(checkedAt)}</time>.
          </p>
        )}
        {issuers.length > 0 && (
          <SearchField
            label="Rechercher une source"
            value={query}
            onChange={setQuery}
            count={visible.length}
          />
        )}
        {issuers.length && !visible.length ? (
          <p role="status">Aucune source ne correspond à cette recherche.</p>
        ) : null}
        {issuers.length ? (
          visible.map((i) => (
            <div className="issuer-row" key={i.id}>
              <BadgeCheck />
              <div>
                <strong>{i.name}</strong>
                <small>{i.id}</small>
                <details>
                  <summary>Voir la clé publique</summary>
                  <pre>{JSON.stringify(i.jwk, null, 2)}</pre>
                  <CopyButton
                    value={JSON.stringify(i.jwk, null, 2)}
                    label={'Copier la clé publique de ' + i.name}
                  />
                  <span className="hash-with-copy">
                    <code className="hash">{i.keyHash}</code>
                    <CopyButton value={i.keyHash} label={'Copier l’empreinte de ' + i.name} />
                  </span>
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
                const checkedKey = publicKeySchema.safeParse(key);
                if (!checkedKey.success)
                  throw Error(
                    'Utilisez uniquement une clé publique P-256 valide, sans clé privée.',
                  );
                const payload = { id, name, jwk: checkedKey.data, approved };
                const previous = issuers.find((i) => i.id === id);
                if (previous && (!approved || previous.keyHash !== (await keyFingerprint(key)))) {
                  setPendingSource(payload);
                  return;
                }
                await saveSource(payload);
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
      {pendingSource && (
        <ConfirmationDialog
          title={
            pendingSource.approved
              ? 'Remplacer la clé de cette source ?'
              : 'Révoquer cette source ?'
          }
          confirmLabel={pendingSource.approved ? 'Remplacer la clé' : 'Révoquer la source'}
          onCancel={() => setPendingSource(null)}
          onConfirm={() => saveSource(pendingSource)}
        >
          <p>
            Les anciennes attestations de cette source ne seront plus considérées comme approuvées
            lors des prochaines vérifications en ligne. Les vérificateurs hors ligne conservent leur
            ancien registre jusqu’à leur actualisation.
          </p>
        </ConfirmationDialog>
      )}
    </>
  );
}
