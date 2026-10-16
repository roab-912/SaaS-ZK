import React from 'react';
import { useState, useEffect } from 'react';
import { ArrowRight, Fingerprint, LoaderCircle, X } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
export function Auth({ mode, setMode, onClose, onDone }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const listener = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" aria-label="Fermer" onClick={onClose}>
          <X size={20} />
        </button>
        <span className="brand-icon">
          <Fingerprint size={30} />
        </span>
        <h2 id="auth-title">
          {mode === 'register' ? 'Votre espace de confiance.' : 'Heureux de vous retrouver.'}
        </h2>
        <p>Vos circuits et vos preuves, au même endroit.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/auth/' + mode, { email, password });
              await onDone();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Adresse e-mail
            <input
              autoFocus
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>12 caractères minimum.</small>
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy} variant="full">
            {busy ? <LoaderCircle size={17} className="spin" /> : null}
            {mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-switch">
          {mode === 'register' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError('');
            }}
          >
            {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </section>
    </div>
  );
}
