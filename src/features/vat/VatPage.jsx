import { downloadOriginalUbl } from '../../lib/ubl-files.js';
import { verifyVatDocuments, VAT_DOCUMENT_LIMITS } from '../../../shared/vat-documents.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { Download, Fingerprint, LoaderCircle, Save } from 'lucide-react';
import { Button, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { download } from '../../lib/files.js';
import { compileForEngine, launchProof } from '../../lib/zk-client.js';
import {
  parseVatBatch,
  vatSummary,
  vatDraftFromBatch,
  vatCircuit,
  vatCapacity,
  vatPublicValues,
  verifyVatManifest,
  parseEuroCents,
} from '../../../shared/vat.mjs';
import { VatStatement } from './VatStatement.jsx';
export function VatPage({ notify, refresh, onVerify, onAuthority }) {
  const [batch, setBatch] = useState(null),
    [claim, setClaim] = useState(''),
    [source, setSource] = useState(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState(''),
    [result, setResult] = useState(null),
    [saved, setSaved] = useState(false);
  const generation = useRef(0),
    task = useRef();
  useEffect(
    () => () => {
      generation.current++;
      task.current?.cancel();
    },
    [],
  );
  async function load(file) {
    if (!file) return;
    const run = ++generation.current;
    setBusy(true);
    setBatch(null);
    setSource(null);
    setResult(null);
    setError('');
    setClaim('');
    try {
      if (file.size > VAT_DOCUMENT_LIMITS.certifiedBytes)
        throw Error('Lot trop volumineux (40 Mo maximum).');
      const parsed = parseVatBatch(JSON.parse(await file.text()));
      if (parsed.format !== 'clair-vat-batch/2')
        throw Error(
          'Ce lot ne contient pas de factures UBL. Faites certifier les XML UBL par votre source de confiance.',
        );
      const issuers = await api('/issuers'),
        verified = await verifyVatManifest(parsed.manifest, issuers);
      if (!verified.valid) throw Error(verified.reason);
      await verifyVatDocuments(parsed);
      if (run !== generation.current) return;
      const totals = vatSummary(vatDraftFromBatch(parsed));
      setBatch(parsed);
      setSource(verified);
      setClaim((totals.net / 100).toFixed(2).replace('.', ','));
    } catch (e) {
      if (run === generation.current) setError(e.message);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }
  async function generate(e) {
    e.preventDefault();
    const run = ++generation.current;
    setBusy(true);
    setError('');
    setSaved(false);
    setResult(null);
    let authorization;
    try {
      if (!batch) throw Error('Importez un lot certifié.');
      const totals = vatSummary(vatDraftFromBatch(batch));
      if (parseEuroCents(claim) !== totals.net)
        throw Error(
          'Le montant annoncé ne correspond pas à la TVA des ventes diminuée des avoirs du lot.',
        );
      const issuers = await api('/issuers'),
        verified = await verifyVatManifest(batch.manifest, issuers);
      if (!verified.valid) throw Error(verified.reason);
      const circuit = vatCircuit(vatCapacity(batch.manifest.count));
      await api('/circuits', circuit);
      if (run !== generation.current) return;
      authorization = await api('/prover/authorize', {});
      setProgress('Préparation du circuit TVA public…');
      const compiled = await compileForEngine(circuit);
      if (run !== generation.current) return;
      task.current = launchProof(
        {
          mode: 'prove',
          circuit,
          compiled,
          engine: circuit.engine,
          vatBatch: batch,
          values: vatPublicValues(batch),
          issuers,
        },
        setProgress,
      );
      const proof = await task.current.promise;
      if (run !== generation.current) return;
      await api('/prover/finish', { token: authorization.token, complete: true });
      authorization = null;
      setResult(proof);
      setBatch(null);
      setClaim('');
      setSource(verified);
      await refresh();
      notify('Preuve de TVA générée et vérifiée sur votre appareil.');
    } catch (e) {
      if (run === generation.current) {
        setError(e.message);
        notify(e.message, true);
      }
    } finally {
      if (authorization?.token)
        try {
          await api('/prover/finish', { token: authorization.token, complete: false });
        } catch {}
      if (run === generation.current) setBusy(false);
    }
  }
  const manifest = batch?.manifest ?? result?.vatManifest;
  const totals = batch
    ? vatSummary(vatDraftFromBatch(batch))
    : result
      ? {
          sales: result.publicData.find((i) => i.id === 'sales_vat').value,
          credits: result.publicData.find((i) => i.id === 'credit_vat').value,
        }
      : null;
  return (
    <>
      <PageHeading
        title="Prouver la TVA collectée"
        desc="Un relevé exhaustif certifié, jusqu’à 500 factures et avoirs. Les détails restent sur votre appareil."
        action={
          <Button variant="secondary" onClick={onAuthority} disabled={busy}>
            Créer un lot de démonstration
          </Button>
        }
      />
      <div className="generate-layout">
        <section className="panel form-panel">
          <h2>1. Importer les factures certifiées</h2>
          <p className="help">
            La source de confiance fournit un lot .clair contenant les factures XML UBL privées et
            le relevé complet signé pour l’entreprise et la période.
          </p>
          <label>
            Lot de factures certifié
            <input
              aria-label="Lot de factures certifié"
              type="file"
              accept=".clair"
              disabled={busy}
              onChange={(e) => {
                load(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
          {error && (
            <div className="validation invalid" role="alert">
              {error}
            </div>
          )}
          {batch && (
            <form onSubmit={generate} noValidate>
              {batch.documents && (
                <details className="ubl-documents">
                  <summary>Documents UBL originaux (privés)</summary>
                  {batch.documents.map((d) => (
                    <button
                      type="button"
                      className="text-link dark"
                      key={d.invoiceId}
                      onClick={() => downloadOriginalUbl(d)}
                    >
                      {d.originalId} · {d.name}
                    </button>
                  ))}
                </details>
              )}
              <h2>2. Confirmer le montant à prouver</h2>
              <label>
                TVA collectée en euros
                <input
                  aria-label="TVA collectée en euros"
                  inputMode="decimal"
                  value={claim}
                  disabled={busy}
                  onChange={(e) => {
                    setClaim(e.target.value);
                    setError('');
                  }}
                />
              </label>
              <p className="help">
                Ventes moins avoirs, en euros. Les factures, leurs dates, bases et taxes sont
                vérifiées dans Noir ; seuls le total, les sous-totaux et le relevé public sont
                partagés.
              </p>
              <Button variant="full" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <Fingerprint size={18} />}
                Générer la preuve TVA
              </Button>
            </form>
          )}
          {busy && (
            <div className="progress" role="status">
              <span>{progress || 'Vérification du relevé signé…'}</span>
              <button
                type="button"
                className="text-link dark"
                onClick={() => {
                  generation.current++;
                  task.current?.cancel();
                  setBusy(false);
                }}
              >
                Annuler
              </button>
            </div>
          )}
          {result && (
            <div className="result-panel">
              <h2>Preuve TVA prête</h2>
              <p>
                Les factures privées ont été retirées du formulaire. Conservez le lot d’origine pour
                un éventuel contrôle.
              </p>
              <Button variant="full" onClick={() => download(result, 'TVA.preuve.clair')}>
                <Download size={16} />
                Télécharger la preuve TVA
              </Button>
              <Button
                variant="secondary full"
                disabled={saved}
                onClick={async () => {
                  try {
                    await api('/proofs', result);
                    setSaved(true);
                    await refresh();
                    notify('Preuve TVA enregistrée.');
                  } catch (e) {
                    notify(e.message, true);
                  }
                }}
              >
                <Save size={16} />
                {saved ? 'Enregistrée' : 'Enregistrer dans mon espace'}
              </Button>
              <button className="text-link dark" onClick={() => onVerify(result)}>
                Ouvrir la vérification
              </button>
            </div>
          )}
          <p className="help">
            Moteur : Noir / UltraHonk. Aucun détail de facture ni clé privée n’est transmis au
            serveur.
          </p>
        </section>
        <aside>
          {manifest && totals ? (
            <VatStatement
              manifest={manifest}
              sales={totals.sales}
              credits={totals.credits}
              source={source}
              proved={!!result}
            />
          ) : (
            <section className="panel explanation">
              <h2>Ce que la preuve contrôle</h2>
              <p>
                La signature de l’autorité sur l’entreprise, la période clôturée et l’empreinte du
                relevé exhaustif.
              </p>
              <p>
                La présence de toutes les pièces du lot, leurs dates, les taux et les arrondis, puis
                l’addition des ventes et des avoirs.
              </p>
              <p>
                Le signataire reste responsable de l’exhaustivité et de la qualification fiscale des
                données qu’il certifie.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
