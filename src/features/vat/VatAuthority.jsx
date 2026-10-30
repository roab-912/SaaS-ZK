import { importUblFiles } from './ubl-import.js';
import { makeUblExamples } from '../../../shared/ubl-examples.mjs';
import { vatDocumentsRoot, UBL_VALIDATION_VERSION } from '../../../shared/vat-documents.mjs';
import { downloadUblExamples, downloadOriginalUbl } from '../../lib/ubl-files.js';
import React, { useEffect, useRef, useState } from 'react';
import { JourneySteps } from '../../components/JourneySteps.jsx';
import { displayDate } from '../../lib/format.js';
import { Button, PageHeading } from '../../components/ui.jsx';
import { DateInput } from '../../components/DateInput.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { launchProof } from '../../lib/zk-client.js';
import { vatSummary, signVatManifest, vatMoney } from '../../../shared/vat.mjs';
export function VatAuthority({ onBack, onReady, onManageSources }) {
  const now = new Date(),
    last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)),
    first = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  const [phase, setPhase] = useState('import'),
    [issuers, setIssuers] = useState([]),
    [issuerId, setIssuerId] = useState(''),
    [company, setCompany] = useState(''),
    [start, setStart] = useState(first.toISOString().slice(0, 10)),
    [end, setEnd] = useState(last.toISOString().slice(0, 10)),
    [count, setCount] = useState('10'),
    [draft, setDraft] = useState(null),
    [documents, setDocuments] = useState(null),
    [reports, setReports] = useState([]),
    [progress, setProgress] = useState(''),
    [key, setKey] = useState(''),
    [complete, setComplete] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const stepHeading = useRef();
  useEffect(() => {
    stepHeading.current?.focus();
  }, [phase, result]);
  const run = useRef(0),
    task = useRef();
  useEffect(() => {
    let alive = true;
    api('/issuers')
      .then((rows) => {
        if (alive) {
          const approved = rows.filter((i) => i.approved !== false);
          setIssuers(approved);
          setIssuerId(approved[0]?.id ?? '');
        }
      })
      .catch(() => {
        if (alive) setError('Registre indisponible.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      run.current++;
      task.current?.cancel();
    };
  }, []);
  const clear = () => {
    setCompany('');
    setDocuments(null);
    setReports([]);
    setProgress('');
    setResult(null);
    setComplete(false);
    setError('');
  };
  async function loadUbl(files) {
    const selected = Array.from(files);
    if (!selected.length) return;
    const token = ++run.current;
    setDraft(null);
    clear();
    setBusy(true);
    try {
      const imported = await importUblFiles(selected, {
        periodStart: start,
        periodEnd: end,
        isCurrent: () => token === run.current,
        onProgress: (message) => {
          if (token === run.current) setProgress(message);
        },
      });
      if (token !== run.current) return;
      setCompany(imported.draft.companyId);
      setCount(String(imported.draft.invoices.length));
      setDraft(imported.draft);
      setDocuments(imported.documents);
      setReports(imported.reports);
    } catch (e) {
      if (token === run.current) setError(e.message);
    } finally {
      if (token === run.current) {
        setBusy(false);
        setProgress('');
      }
    }
  }

  async function sign() {
    const token = ++run.current;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress('');
    try {
      if (!complete) throw Error('Confirmez l’exhaustivité du relevé.');
      const source = issuers.find((i) => i.id === issuerId);
      if (!source) throw Error('Choisissez une source approuvée.');
      if (!draft || !documents?.length)
        throw Error('Importez les factures XML UBL avant de certifier le relevé.');
      vatSummary(draft);
      if (Date.now() < Date.parse(draft.periodEnd + 'T23:59:59.999Z'))
        throw Error('La période doit être clôturée avant la certification.');
      if (key.length > 4096) throw Error('Clé privée trop volumineuse.');
      let privateKey;
      try {
        privateKey = JSON.parse(key);
      } catch {
        throw Error('Sélectionnez un fichier de clé privée valide pour la source avant de signer.');
      }
      task.current = launchProof({ mode: 'vat-commit', draft });
      const commitment = await task.current.promise;
      if (token !== run.current) return;
      const issued = Date.now();
      const documentsRoot = await vatDocumentsRoot({
        documents,
        blinding: commitment.blinding,
        ...draft,
      });
      const manifest = await signVatManifest(
        {
          format: 'clair-vat-manifest/2',
          validation: UBL_VALIDATION_VERSION,
          documentsRoot,
          issuerId: source.id,
          companyId: draft.companyId,
          companyHash: commitment.companyHash,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          currency: 'EUR',
          scope: 'sales-and-credit-notes/invoice-date',
          rounding: 'half-up-per-invoice-rate',
          complete: true,
          count: draft.invoices.length,
          commitment: commitment.commitment,
          issuedAt: new Date(issued).toISOString(),
          expiresAt: new Date(issued + 90 * 86400000).toISOString(),
        },
        privateKey,
        source.jwk,
      );
      if (token !== run.current) return;
      setResult({
        format: 'clair-vat-batch/2',
        documents,
        manifest,
        blinding: commitment.blinding,
        invoices: draft.invoices,
      });
    } catch (e) {
      if (token === run.current) setError(e.message);
    } finally {
      if (token === run.current) {
        setBusy(false);
        setKey('');
      }
    }
  }
  const change = (setter) => (v) => {
    setter(v);
    setDraft(null);
    clear();
  };

  const summary = draft ? vatSummary(draft) : null;
  const selectedSource = issuers.find((i) => i.id === issuerId);
  async function continueToProof() {
    const token = ++run.current;
    setBusy(true);
    setError('');
    try {
      await onReady(result);
    } catch (e) {
      if (token === run.current) setError(e.message);
    } finally {
      if (token === run.current) setBusy(false);
    }
  }
  function changeStep(next) {
    run.current++;
    task.current?.cancel();
    setKey('');
    setError('');
    setResult(null);
    setComplete(false);
    setPhase(next);
  }
  return (
    <>
      <PageHeading
        title={onReady ? 'Préparer mes factures' : 'Certifier un relevé de factures'}
        desc="Ajoutez vos factures, vérifiez le récapitulatif, puis faites signer le lot par une source de confiance."
        action={
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            {onReady ? 'Retour à la TVA' : 'Retour aux sources'}
          </Button>
        }
      />
      <JourneySteps
        steps={['Mes factures', 'Signature', 'Ma preuve']}
        current={result ? 2 : phase === 'import' ? 0 : 1}
      />
      <section className="panel form-panel vat-authority">
        {error && (
          <div className="validation invalid" role="alert">
            {error}
          </div>
        )}
        <h2 ref={stepHeading} tabIndex={-1}>
          {result
            ? 'Vos factures sont signées'
            : phase === 'import'
              ? '1. Ajouter mes factures'
              : '2. Faire signer mes factures'}
        </h2>
        {phase === 'import' && (
          <>
            <p className="help">
              Choisissez la période à justifier, puis les factures et avoirs de la même entreprise.
              Leurs dates doivent appartenir à cette période.
            </p>
            <div className="vat-fields">
              <label>
                Début de période
                <DateInput
                  aria-label="Début de période"
                  value={start}
                  disabled={busy}
                  onChange={change(setStart)}
                />
              </label>
              <label>
                Fin de période
                <DateInput
                  aria-label="Fin de période"
                  value={end}
                  disabled={busy}
                  onChange={change(setEnd)}
                />
              </label>
            </div>
            <label>
              Mes factures XML
              <input
                aria-label="Importer des factures UBL"
                type="file"
                accept=".xml,application/xml,text/xml"
                multiple
                disabled={busy}
                onChange={(e) => {
                  loadUbl(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="help">
              Sélectionnez les fichiers XML UBL exportés par votre logiciel de facturation. Vous
              pouvez en ajouter jusqu’à 500 ; ils restent sur votre appareil.
            </p>
            <details className="journey-details">
              <summary>Essayer avec des exemples</summary>
              <label>
                Nombre de factures d’exemple
                <input
                  aria-label="Nombre de pièces de démonstration"
                  type="number"
                  min="1"
                  max="500"
                  value={count}
                  disabled={busy}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  try {
                    downloadUblExamples(
                      makeUblExamples({ count: Number(count), periodStart: start, periodEnd: end }),
                    );
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Télécharger des exemples UBL
              </Button>
              <p className="help">
                Décompressez le ZIP téléchargé, puis sélectionnez ses fichiers XML ci-dessus. Ces
                factures sont fictives.
              </p>
            </details>
          </>
        )}
        {summary && (
          <div className="journey-summary">
            <strong>{draft.invoices.length} factures et avoirs prêts</strong>
            <dl>
              <div>
                <dt>Entreprise</dt>
                <dd>{company}</dd>
              </div>
              <div>
                <dt>Période</dt>
                <dd>
                  {displayDate(draft.periodStart)} au {displayDate(draft.periodEnd)}
                </dd>
              </div>
              <div>
                <dt>TVA facturée, après avoirs</dt>
                <dd>{vatMoney(summary.net)}</dd>
              </div>
            </dl>
            <p className="help">
              {result
                ? 'La source a signé ce lot complet. Vous pouvez maintenant créer la preuve.'
                : 'Les fichiers ont passé les contrôles de format. La source doit encore certifier que toutes les factures de la période sont présentes.'}
            </p>
            <details className="journey-details ubl-documents">
              <summary>Voir les fichiers et les contrôles</summary>
              <strong>{documents.length} documents UBL validés localement</strong>
              <p className="help">
                UBL 2.1 / EN16931, et Peppol selon le profil. Aucun fichier non conforme n’est
                corrigé automatiquement.
              </p>
              {documents.map((d, i) => (
                <div key={d.invoiceId}>
                  <button
                    type="button"
                    className="text-link dark"
                    onClick={() => downloadOriginalUbl(d)}
                  >
                    {d.name}
                  </button>
                  {reports[i]?.warnings.map((w, n) => (
                    <p className="help" key={n}>
                      [{w.id}] {w.text}
                    </p>
                  ))}
                </div>
              ))}
              <p className="help">
                2 Mo par fichier et 25 Mo au total. EUR, même fournisseur ; taux 20 %, 10 %, 5,5 %,
                2,1 % et catégories sans TVA prises en charge. Les contrôles nationaux français
                supplémentaires ne sont pas inclus.
              </p>
            </details>
          </div>
        )}
        {phase === 'import' && (
          <Button variant="full" disabled={busy || !draft} onClick={() => changeStep('sign')}>
            Continuer vers la signature
          </Button>
        )}
        {phase === 'sign' && !result && (
          <>
            <p className="notice">
              Cette étape est réservée à la personne autorisée à signer pour la source de confiance.
              Si votre logiciel vous a déjà fourni un lot signé, importez-le directement depuis la
              page TVA.
            </p>
            <label>
              Qui certifie ces factures ?
              <select
                aria-label="Source émettrice TVA"
                value={issuerId}
                disabled={busy || loading}
                onChange={(e) => {
                  setIssuerId(e.target.value);
                  setKey('');
                  setComplete(false);
                  setError('');
                }}
              >
                {!issuers.length && <option value="">Aucune source disponible</option>}
                {issuers.map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            {!loading && !issuers.length && (
              <div className="notice">
                <p>
                  Aucune source approuvée disponible. Un administrateur doit ajouter la source qui
                  certifie vos factures.
                </p>
                {onManageSources && (
                  <Button variant="secondary" onClick={onManageSources}>
                    Voir les sources de confiance
                  </Button>
                )}
              </div>
            )}
            <label>
              Clé de signature de la source (.clair)
              <input
                aria-label="Importer la clé privée TVA"
                type="file"
                accept=".clair"
                disabled={busy || !issuerId}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  e.target.value = '';
                  if (!f) return;
                  const token = ++run.current;
                  setKey('');
                  setError('');
                  try {
                    if (f.size > 4096) throw Error('Clé trop volumineuse (4 Ko maximum).');
                    const text = await f.text();
                    if (token === run.current) setKey(text);
                  } catch (e) {
                    if (token === run.current) setError(e.message);
                  }
                }}
              />
            </label>
            {key && (
              <p className="help" role="status">
                Clé de signature chargée. Sa correspondance avec la source sera vérifiée à la
                signature.
              </p>
            )}
            <p className="help">
              Utilisez uniquement la clé privée de {selectedSource?.name ?? 'la source choisie'} si
              vous êtes autorisé à signer en son nom. Elle reste sur cet appareil et n’est pas
              incluse dans le lot.
            </p>
            <details className="journey-details">
              <summary>Coller une clé de signature (avancé)</summary>
              <label>
                Clé privée de l’émetteur TVA
                <textarea
                  aria-label="Clé privée de l’émetteur TVA"
                  value={key}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Clé privée JWK P-256 de la source"
                />
              </label>
            </details>
            <label className="vat-confirm">
              <input
                type="checkbox"
                checked={complete}
                disabled={busy}
                onChange={(e) => setComplete(e.target.checked)}
              />
              Je certifie que ce lot contient toutes les ventes et tous les avoirs de cette
              entreprise sur la période, sans doublon, et que les taux et motifs sans TVA sont
              corrects.
            </label>
            <Button
              variant="full"
              disabled={busy || !draft || !issuerId || !complete}
              onClick={sign}
            >
              {busy ? 'Signature en cours…' : 'Signer le relevé complet'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => changeStep('import')}>
              Modifier les factures
            </Button>
          </>
        )}
        {busy && (
          <div className="progress" role="status">
            <span>{progress || 'Vérification sur votre appareil…'}</span>
            <button
              type="button"
              className="text-link dark"
              onClick={() => {
                run.current++;
                task.current?.cancel();
                setBusy(false);
                setProgress('');
                setKey('');
              }}
            >
              Annuler
            </button>
          </div>
        )}
        {result && (
          <div className="result-panel">
            <h2>Lot certifié prêt</h2>
            <p>
              La signature de la source a été vérifiée. Le lot signé reste valable 90 jours et votre
              clé privée a été retirée du formulaire.
            </p>
            {onReady && (
              <Button variant="full" disabled={busy} onClick={continueToProof}>
                Continuer vers ma preuve
              </Button>
            )}
            <Button
              variant={onReady ? 'secondary' : 'full'}
              disabled={busy}
              onClick={() => download(result, 'Factures.certifiees.clair')}
            >
              Télécharger le lot certifié
            </Button>
            <p className="help">
              Conservez une copie du lot signé pour vos archives ou un contrôle. Il contient les
              factures privées : transmettez uniquement la preuve à votre destinataire.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
