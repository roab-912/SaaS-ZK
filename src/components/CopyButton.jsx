import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
export function CopyButton({ value, label = 'Copier' }) {
  const [status, setStatus] = useState(''),
    timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(String(value));
      setStatus('copied');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('error');
    }
  }
  return (
    <span className="copy-control no-print">
      <button
        type="button"
        className="icon-button copy-button"
        aria-label={label}
        title={label}
        onClick={copy}
      >
        {status === 'copied' ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <span
        className={status === 'error' ? 'copy-error' : 'sr-only'}
        role={status === 'error' ? 'alert' : 'status'}
      >
        {status === 'copied'
          ? 'Copié dans le presse-papiers.'
          : status === 'error'
            ? 'Copie indisponible. Sélectionnez le texte pour le copier manuellement.'
            : ''}
      </span>
    </span>
  );
}
