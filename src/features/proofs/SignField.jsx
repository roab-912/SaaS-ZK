import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui.jsx';
import { signInputValue } from '../../../shared/attestations.mjs';
export function SignField({ input, value, disabled, onSigned }) {
  const [key, setKey] = useState(''),
    [signing, setSigning] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(value),
    mounted = useRef(true);
  latest.current = value;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function sign() {
    setError('');
    setSigning(true);
    const signedValue = value;
    try {
      const attestation = await signInputValue(input, signedValue, key);
      if (!mounted.current) return;
      if (latest.current !== signedValue) throw Error('La valeur a changé : signez-la à nouveau.');
      onSigned(attestation);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) {
        setKey('');
        setSigning(false);
      }
    }
  }
  return (
    <div>
      <label>
        Clé privée pour {input.label}
        <textarea
          aria-label={'Clé privée pour ' + input.label}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError('');
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || signing}
          placeholder="Collez la clé privée JWK de cette source"
        />
      </label>
      <label className="help">
        Importer une clé privée pour {input.label}
        <input
          aria-label={'Importer une clé privée pour ' + input.label}
          type="file"
          accept=".json"
          disabled={disabled || signing}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setKey('');
            setError('');
            const element = e.target;
            try {
              if (file.size > 4096) throw Error('Fichier de clé trop volumineux (4 Ko maximum).');
              const text = await file.text();
              if (mounted.current) setKey(text);
            } catch {
              if (mounted.current)
                setError('Fichier de clé invalide ou trop volumineux (4 Ko maximum).');
            } finally {
              element.value = '';
            }
          }}
        />
      </label>
      <p className="help">
        La clé privée reste sur cet appareil et est effacée de ce champ après la signature.
        L’attestation publique est valable 7 jours.
      </p>
      {error && (
        <p className="validation invalid" role="alert">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || signing || !key.trim()}
        onClick={sign}
      >
        {signing ? 'Signature en cours…' : 'Signer ' + input.label}
      </Button>
    </div>
  );
}
