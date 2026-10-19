import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui.jsx';
import { signInputValue } from '../../../shared/attestations.mjs';
export function SignField({ input, value, disabled, onSigned }) {
  return (
    <SignInputs
      items={[{ input, value }]}
      label={input.label}
      disabled={disabled}
      onSigned={(results) => onSigned(results[0])}
    />
  );
}
export function SignFields({ items, disabled, onSigned }) {
  return (
    <SignInputs
      items={items}
      label="les données du circuit"
      disabled={disabled}
      onSigned={onSigned}
    />
  );
}
function SignInputs({ items, label, disabled, onSigned }) {
  const [key, setKey] = useState(''),
    [signing, setSigning] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(''),
    mounted = useRef(true);
  latest.current = JSON.stringify(items);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function sign() {
    setError('');
    setSigning(true);
    const snapshot = latest.current,
      now = Date.now();
    try {
      if (!items.length) throw Error('Aucun champ à signer.');
      const results = await Promise.all(
        items.map(async ({ input, value }) => {
          try {
            return await signInputValue(input, value, key, now);
          } catch (error) {
            throw Error(input.label + ' : ' + error.message, { cause: error });
          }
        }),
      );
      if (!mounted.current) return;
      if (latest.current !== snapshot)
        throw Error('Les valeurs ont changé : signez-les à nouveau.');
      onSigned(results);
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
        Clé privée pour {label}
        <textarea
          aria-label={'Clé privée pour ' + label}
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
        Importer une clé privée pour {label}
        <input
          aria-label={'Importer une clé privée pour ' + label}
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
              if (file.size > 4096) throw Error();
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
        La clé privée reste sur cet appareil et est effacée de ce champ après la signature. Les
        attestations sont valables 7 jours.
      </p>
      {error && (
        <p className="validation invalid" role="alert">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || signing || !key.trim() || !items.length}
        onClick={sign}
      >
        {signing ? 'Signature en cours…' : 'Signer ' + label}
      </Button>
    </div>
  );
}
