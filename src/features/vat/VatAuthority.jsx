import { importUblFiles } from './ubl-import.js';
import { makeUblExamples } from '../../../shared/ubl-examples.mjs';
import { vatDocumentsRoot, UBL_VALIDATION_VERSION } from '../../../shared/vat-documents.mjs';
import { downloadUblExamples, downloadOriginalUbl } from '../../lib/ubl-files.js';
import React, { useEffect, useRef, useState } from 'react';
import { Button, PageHeading } from '../../components/ui.jsx';
import { DateInput } from '../../components/DateInput.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { launchProof } from '../../lib/zk-client.js';
import { vatSummary, signVatManifest } from '../../../shared/vat.mjs';
export function VatAuthority({ onBack }) {
  const now = new Date(),
    last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)),
    first = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  const [issuers, setIssuers] = useState([]),
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
      const privateKey = JSON.parse(key);
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
  return (
    <>
      <PageHeading
        title="Certifier un relevé de factures"
        desc="Importer les factures XML UBL de la période et signer le relevé complet sur votre appareil."
        action={
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            Retour
          </Button>
        }
      />
      <section className="panel form-panel vat-authority">
        <p className="notice">
          L’émetteur doit être une source approuvée par l’administrateur. La signature porte sur un
          engagement de toutes les factures du lot, sans devoir générer lui-même la preuve ZK.
        </p>
        {error && (
          <div className="validation invalid" role="alert">
            {error}
          </div>
        )}
        <label>
          Source émettrice
          <select
            aria-label="Source émettrice TVA"
            value={issuerId}
            disabled={busy}
            onChange={(e) => {
              setIssuerId(e.target.value);
              setResult(null);
              setComplete(false);
            }}
          >
            {issuers.map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        {!loading && !issuers.length && (
          <p>
            Aucune source approuvée disponible. Ajoutez d’abord sa clé publique dans Sources de
            confiance.
          </p>
        )}
        <h2>1. Importer les factures UBL</h2>
        <div className="vat-fields">
          <label>
            Identifiant de l’entreprise
            <input
              aria-label="Identifiant de l’entreprise"
              value={company}
              disabled={busy}
              readOnly
              placeholder="Déduit des factures UBL importées"
            />
          </label>
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
          <label>
            Nombre de pièces de démonstration
            <input
              aria-label="Nombre de pièces de démonstration"
              type="number"
              min="1"
              max="500"
              value={count}
              disabled={busy}
              onChange={(e) => change(setCount)(e.target.value)}
            />
          </label>
        </div>
        <label>
          Importer des factures UBL (.xml)
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
          UBL 2.1 EN16931 ou Peppol BIS Billing 3.0, en EUR, même fournisseur. Jusqu’à 500 fichiers,
          2 Mo par fichier et 25 Mo au total. Renseignez la période avant l’import. L’import seul ne
          certifie pas l’exhaustivité. Fournisseurs étrangers acceptés dans les taux pris en charge.
          Les catégories AE (autoliquidation) et G (export) contribuent avec une TVA facturée nulle
          ; la qualification fiscale est certifiée par la source.
        </p>
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
          Décompressez l’archive puis sélectionnez les fichiers XML. Les exemples sont fictifs.
        </p>
        {busy && progress && (
          <div className="progress" role="status">
            <span>{progress}</span>
            <button
              type="button"
              className="text-link dark"
              onClick={() => {
                run.current++;
                setBusy(false);
                setProgress('');
              }}
            >
              Annuler l’import
            </button>
          </div>
        )}
        {draft && (
          <>
            <p>
              {draft.invoices.length} pièces préparées pour {draft.companyId}.
            </p>
            {documents && (
              <div className="notice">
                <div>
                  <strong>{documents.length} documents UBL validés localement</strong>
                  <p>
                    XSD UBL 2.1 et EN16931 ; règles Peppol appliquées aux documents de ce profil.
                    Les contrôles nationaux français supplémentaires ne sont pas inclus.
                  </p>
                  <p>
                    {reports.reduce((n, r) => n + r.warnings.length, 0)} avertissement(s) non
                    bloquant(s).
                  </p>
                  <details>
                    <summary>Documents originaux et diagnostics</summary>
                    {documents.map((d, i) => (
                      <div key={d.invoiceId}>
                        <button
                          type="button"
                          className="text-link dark"
                          onClick={() => downloadOriginalUbl(d)}
                        >
                          {d.name} · {d.profile}
                        </button>
                        {reports[i]?.warnings.map((w, n) => (
                          <p className="help" key={n}>
                            [{w.id}] {w.text}
                          </p>
                        ))}
                      </div>
                    ))}
                  </details>
                </div>
              </div>
            )}
            <details>
              <summary>Consulter les données privées préparées</summary>
              <pre>{JSON.stringify(draft, null, 2)}</pre>
            </details>
          </>
        )}
        <h2>2. Certifier le relevé complet</h2>
        <label className="vat-confirm">
          <input
            type="checkbox"
            checked={complete}
            disabled={busy}
            onChange={(e) => setComplete(e.target.checked)}
          />
          Je certifie que ce lot contient toutes les ventes et tous les avoirs de cette entreprise
          dans la période, sans doublon, et que les taux et motifs sans TVA sont corrects.
        </label>
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
        <label>
          Importer la clé privée TVA
          <input
            aria-label="Importer la clé privée TVA"
            type="file"
            accept=".clair"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files[0];
              e.target.value = '';
              if (!f) return;
              const token = ++run.current;
              setKey('');
              try {
                if (f.size > 4096) throw Error('Clé trop volumineuse.');
                const text = await f.text();
                if (token === run.current) setKey(text);
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </label>
        <Button disabled={busy || !draft || !issuerId || !complete} onClick={sign}>
          {busy ? 'Certification locale…' : 'Signer le relevé complet'}
        </Button>
        {result && (
          <div className="result-panel">
            <h2>Lot certifié prêt</h2>
            <p>
              Remettez ce fichier uniquement à l’entreprise concernée : il contient les factures
              privées et le relevé signé. Le relevé expire après 90 jours. La clé privée a été
              effacée du formulaire.
            </p>
            <Button onClick={() => download(result, 'Factures.certifiees.clair')}>
              Télécharger le lot certifié
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
