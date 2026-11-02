import React from 'react';
import { circuitName, date, displayDate } from '../../lib/format.js';
import { describe, publicValues, proofResult } from '../../../shared/circuit.mjs';
import { vatMoney } from '../../../shared/vat.mjs';
export function PublicVerificationReport({
  envelope,
  status,
  checkedAt,
  sources = [],
  error = '',
}) {
  if (!envelope || !status || !checkedAt) return null;
  const fields = publicValues(envelope),
    outcome = proofResult(envelope),
    valid = status === 'valid';
  const manifest = envelope.vatManifest;
  return (
    <article className="verification-report" aria-label="Rapport public de vérification">
      <h1>Clair — Rapport de vérification</h1>
      <p>{circuitName(envelope.circuit)}</p>
      <p>
        <strong>{valid ? 'Preuve valide' : 'Preuve non validée'}</strong> ·{' '}
        {valid ? 'Résultat prouvé' : 'Résultat annoncé, non validé'} : {outcome ? 'Vrai' : 'Faux'}
      </p>
      {valid && !outcome && (
        <p>La preuve est valide ; la condition demandée n’est pas satisfaite.</p>
      )}
      {!valid && (
        <p>{error || 'La preuve, ses paramètres ou sa provenance n’ont pas été validés.'}</p>
      )}
      <p>
        Vérification effectuée sur cet appareil le{' '}
        <time dateTime={checkedAt}>
          {date(checkedAt)} à{' '}
          {new Date(checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </time>
        .
      </p>
      <h2>Règle et empreinte</h2>
      <p>{describe(envelope.circuit)}</p>
      <p className="hash">{envelope.circuitHash}</p>
      <h2>Informations publiques {valid ? 'vérifiées' : 'annoncées'}</h2>
      {fields.length ? (
        <dl>
          {fields.map((i) => (
            <div key={i.id}>
              <dt>{i.label}</dt>
              <dd>
                {i.type === 'date'
                  ? displayDate(i.value)
                  : i.type === 'boolean'
                    ? i.value
                      ? 'Vrai'
                      : 'Faux'
                    : String(i.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Les valeurs d’entrée sont privées.</p>
      )}
      {manifest && (
        <>
          <h2>Relevé TVA</h2>
          <p>Entreprise : {manifest.companyId}</p>
          <p>
            Période : {displayDate(manifest.periodStart)} au {displayDate(manifest.periodEnd)} ·{' '}
            {manifest.count} factures et avoirs.
          </p>
          <p>
            TVA collectée :{' '}
            {vatMoney(
              Number(fields.find((i) => i.id === 'sales_vat')?.value ?? 0) -
                Number(fields.find((i) => i.id === 'credit_vat')?.value ?? 0),
            )}
          </p>
          <p>L’exhaustivité du relevé est une déclaration de l’autorité signataire.</p>
        </>
      )}
      <h2>Provenance</h2>
      {sources.length ? (
        <ul>
          {sources.map((source, index) => (
            <li key={source.inputId ?? index}>
              {source.issuerName ?? source.issuerId ?? 'Source'} :{' '}
              {source.valid
                ? 'source vérifiée dans le registre consulté'
                : source.reason || 'provenance non validée'}
              {source.expiresAt ? ' · Expiration : ' + date(source.expiresAt) : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucune provenance certifiée n’a été validée pour ce rapport.</p>
      )}
      <p>
        Ce rapport contient uniquement les informations publiques. Il ne remplace pas le fichier de
        preuve .clair : vérifiez ce fichier et l’empreinte du circuit auprès de votre instance de
        confiance. Le contrôle dépend du registre et de l’horloge utilisés au moment indiqué.
      </p>
    </article>
  );
}
