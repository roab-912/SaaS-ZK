import React, { useState, useEffect, useRef, useId } from 'react';
import { BadgeCheck, KeyRound } from 'lucide-react';
import { CopyButton } from '../../components/CopyButton.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ConfirmationDialog } from '../../components/ConfirmationDialog.jsx';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { matchesSearch } from '../../lib/search.js';
import { date } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { downloadBytes } from '../../lib/files.js';
import {
  generateSourceKeys,
  readSourcePublicKey,
  normalizeSourceId,
  sourceKeysArchive,
} from './source-keys.js';
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
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [keyBusy, setKeyBusy] = useState(false),
    [keyNotice, setKeyNotice] = useState(''),
    [offline, setOffline] = useState(null),
    [query, setQuery] = useState(''),
    [checkedAt, setCheckedAt] = useState(null),
    [pendingSource, setPendingSource] = useState(null),
    [editing, setEditing] = useState(null);
  const operation = useRef(0);
  const idHelp = useId();
  const idHint =
    '1 à 40 caractères : lettres minuscules, chiffres et tirets. Exemple : source-test.';
  const admin = !!user?.admin;
  const busy = saving || keyBusy;
  const refresh = async () => {
    const rows = await api(admin ? '/admin/issuers' : '/issuers');
    setIssuers(
      await Promise.all(
        rows.map(async (source) => ({
          ...source,
          keyHash: await keyFingerprint(source.jwk),
        })),
      ),
    );
    setCheckedAt(new Date().toISOString());
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    return () => {
      operation.current++;
    };
  }, [admin]);
  useEffect(() => {
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
  const visible = issuers.filter((source) =>
    matchesSearch(query, source.name, source.id, source.keyHash),
  );

  async function saveSource(payload) {
    await api('/issuers', payload);
    await refresh();
    setEditing(null);
    notify('Registre mis à jour.');
  }
  async function submitSource(draft) {
    setError('');
    setSaving(true);
    try {
      if (!/^[a-z0-9-]{1,40}$/.test(draft.id)) throw Error('Identifiant : ' + idHint);
      const key = await readSourcePublicKey(draft.jwk);
      const payload = { id: draft.id, name: draft.name, jwk: key, approved: draft.approved };
      const previous = issuers.find((source) => source.id === draft.id);
      if (
        previous &&
        ((previous.approved !== false && !payload.approved) ||
          previous.keyHash !== (await keyFingerprint(key)))
      ) {
        setPendingSource(payload);
        return;
      }
      await saveSource(payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function generateKeys() {
    const token = ++operation.current;
    setKeyBusy(true);
    setError('');
    setKeyNotice('');
    try {
      const keys = await generateSourceKeys();
      if (token !== operation.current) return;
      const fileId = id.replace(/^-+|-+$/g, '') || 'source';
      // Trigger one download so browsers do not block a second automatic file.
      downloadBytes(sourceKeysArchive(keys, fileId), fileId + '.cles.zip', 'application/zip');
      setJwk(JSON.stringify(keys.publicKey, null, 2));
      setKeyNotice(
        'Clés téléchargées dans une archive ZIP. Conservez le fichier .cle-privee.clair pour signer.',
      );
    } catch (e) {
      if (token === operation.current)
        setError(e.message || 'Impossible de générer et télécharger les clés. Réessayez.');
    } finally {
      if (token === operation.current) setKeyBusy(false);
    }
  }
  async function importKey(event) {
    const element = event.target;
    const file = element.files[0];
    if (!file) return;
    const token = ++operation.current;
    setKeyBusy(true);
    setError('');
    try {
      if (file.size > 4096) throw Error('Fichier de clé trop volumineux (4 Ko maximum).');
      const key = await readSourcePublicKey(await file.text());
      if (token !== operation.current) return;
      setJwk(JSON.stringify(key, null, 2));
      setKeyNotice('Clé publique importée.');
    } catch (e) {
      if (token === operation.current) setError(e.message);
    } finally {
      element.value = '';
      if (token === operation.current) setKeyBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Sources de confiance"
        desc="Ajoutez vos autorités de confiance et gérez leurs clés de signature."
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
      {admin && (
        <section className="panel form-panel issuer-form">
          <h2>Ajouter une autorité</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              const sourceId = id.replace(/^-+|-+$/g, '');
              setId(sourceId);
              submitSource({ id: sourceId, name, jwk, approved: true });
            }}
          >
            <label>
              Nom
              <input
                required
                maxLength={80}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Identifiant
              <input
                required
                maxLength={40}
                pattern={'[a-z0-9\\-]{1,40}'}
                title={idHint}
                aria-describedby={idHelp}
                placeholder="source-test"
                value={id}
                disabled={busy}
                onChange={(e) => setId(normalizeSourceId(e.target.value))}
                onBlur={() => setId((value) => value.replace(/^-+|-+$/g, ''))}
              />
            </label>
            <p className="help" id={idHelp}>
              {idHint}
            </p>
            <div className="row-actions">
              <Button
                type="button"
                variant="small secondary"
                disabled={busy}
                onClick={generateKeys}
              >
                <KeyRound size={15} />
                {keyBusy ? 'Préparation…' : 'Générer les clés'}
              </Button>
            </div>
            <p className="help">
              Télécharge les clés privée et publique dans un ZIP et remplit la clé publique.
            </p>
            {keyNotice && (
              <p className="help" role="status">
                {keyNotice}
              </p>
            )}
            <details className="journey-details">
              <summary>Clé publique et import d’une clé existante</summary>
              <label>
                Importer une clé publique existante (.clair ou .json)
                <input
                  type="file"
                  accept=".clair,.json,application/json"
                  disabled={busy}
                  onChange={importKey}
                />
              </label>
              <label>
                Clé publique P-256 (JWK)
                <textarea
                  value={jwk}
                  disabled={busy}
                  onChange={(e) => {
                    setJwk(e.target.value);
                    setKeyNotice('');
                  }}
                  placeholder='{"kty":"EC","crv":"P-256","x":"…","y":"…"}'
                />
              </label>
            </details>
            <Button disabled={busy || !jwk.trim()}>Enregistrer la source</Button>
          </form>
        </section>
      )}
      <section className="panel form-panel sources-list">
        <div className="row-actions source-downloads">
          <h2>Autorités de confiance</h2>
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
              ' Mio environ. Extrayez l’archive ZIP puis lancez demarrer.cmd.'
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
        {issuers.length > 0 && !visible.length && (
          <p role="status">Aucune source ne correspond à cette recherche.</p>
        )}
        {issuers.length > 0 ? (
          <div
            className="table-wrap issuer-table"
            tabIndex={0}
            role="region"
            aria-label="Liste des autorités de confiance"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Identifiant</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Clé publique</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((source) => {
                  const row = editing?.id === source.id ? editing : null;
                  return (
                    <tr key={source.id}>
                      <td>
                        {row ? (
                          <input
                            aria-label={'Nom de ' + source.id}
                            required
                            maxLength={80}
                            disabled={busy}
                            value={row.name}
                            onChange={(e) => setEditing({ ...row, name: e.target.value })}
                          />
                        ) : (
                          <strong>{source.name}</strong>
                        )}
                      </td>
                      <td>
                        <code>{source.id}</code>
                      </td>
                      <td>
                        {row ? (
                          <select
                            aria-label={'Statut de ' + source.id}
                            value={String(row.approved)}
                            disabled={busy}
                            onChange={(e) =>
                              setEditing({ ...row, approved: e.target.value === 'true' })
                            }
                          >
                            <option value="true">Approuvée</option>
                            <option value="false">Révoquée</option>
                          </select>
                        ) : (
                          <Badge tone={source.approved === false ? 'warning' : ''}>
                            {source.approved === false ? 'Révoquée' : 'Approuvée'}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {row ? (
                          <textarea
                            aria-label={'Clé publique de ' + source.id}
                            disabled={busy}
                            value={row.jwk}
                            onChange={(e) => setEditing({ ...row, jwk: e.target.value })}
                          />
                        ) : (
                          <details>
                            <summary>Voir la clé publique</summary>
                            <pre>{JSON.stringify(source.jwk, null, 2)}</pre>
                            <CopyButton
                              value={JSON.stringify(source.jwk, null, 2)}
                              label={'Copier la clé publique de ' + source.name}
                            />
                            <span className="hash-with-copy">
                              <code className="hash">{source.keyHash}</code>
                              <CopyButton
                                value={source.keyHash}
                                label={'Copier l’empreinte de ' + source.name}
                              />
                            </span>
                          </details>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {admin &&
                            (row ? (
                              <>
                                <Button
                                  type="button"
                                  variant="small"
                                  disabled={busy || !row.name.trim() || !row.jwk.trim()}
                                  onClick={() => submitSource(row)}
                                >
                                  Enregistrer
                                </Button>
                                <Button
                                  type="button"
                                  variant="small secondary"
                                  disabled={busy}
                                  onClick={() => setEditing(null)}
                                >
                                  Annuler
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="small secondary"
                                disabled={busy}
                                onClick={() => {
                                  setEditing({
                                    id: source.id,
                                    name: source.name,
                                    jwk: JSON.stringify(source.jwk, null, 2),
                                    approved: source.approved !== false,
                                  });
                                  setError('');
                                }}
                              >
                                Modifier
                              </Button>
                            ))}
                          {offline?.available && source.approved !== false && (
                            <a
                              className="button small secondary"
                              href={'/api/offline-verifier?issuer=' + encodeURIComponent(source.id)}
                              download
                              aria-label={'Télécharger le vérificateur pour ' + source.name}
                            >
                              Vérificateur hors ligne
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={BadgeCheck} title="Aucune source disponible">
            {admin
              ? 'Ajoutez une autorité avec le formulaire ci-dessus.'
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
              Connecter une identité numérique et utiliser ses attributs dans un parcours
              d’attestation et de preuve. Ce module reste à développer.
            </p>
          </div>
          <Badge>Bientôt</Badge>
        </article>
      </section>
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
