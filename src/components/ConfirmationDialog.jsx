import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from './ui.jsx';
export function ConfirmationDialog({
  title,
  children,
  confirmLabel = 'Confirmer',
  onConfirm,
  onCancel,
}) {
  const ref = useRef(),
    cancel = useRef(),
    running = useRef(false),
    titleId = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    cancel.current?.focus();
    return () => {
      dialog.close?.();
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  async function confirm() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      cancelRef.current();
    } catch (e) {
      setError(e.message || 'L’action a échoué. Réessayez.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="confirmation-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cancelRef.current();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="confirmation-description">{children}</div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="journey-actions">
        <Button type="button" ref={cancel} variant="secondary" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" disabled={busy} onClick={confirm}>
          {busy ? 'Traitement en cours…' : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
