import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Fingerprint, LoaderCircle, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
export function Auth({ mode, setMode, onClose, onDone, embedded = false }) {
  const returnFocus = useRef(document.activeElement);
  const Heading = embedded ? 'h1' : 'h2';
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (embedded) return;
    const previous = returnFocus.current;
    return () => previous?.focus();
  }, [embedded]);
  useEffect(() => {
    const listener = (e) => {
      if (e.key === 'Escape' && !embedded) onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose, embedded]);
  return (
    <div className={embedded ? 'auth-page' : 'modal-backdrop'}>
      <section
        className="modal"
        role={embedded ? undefined : 'dialog'}
        aria-modal={embedded ? undefined : 'true'}
        aria-labelledby="auth-title"
        onKeyDown={(event) => {
          if (embedded || event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll(':is(button, input, a[href]):not(:disabled)'),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        {!embedded && (
          <button className="icon-button modal-close" aria-label="Fermer" onClick={onClose}>
            <X size={20} />
          </button>
        )}
        <span className="brand-icon">
          <Fingerprint size={30} />
        </span>
        <Heading id="auth-title">
          {mode === 'register' ? 'Votre espace de confiance.' : 'Heureux de vous retrouver.'}
        </Heading>
        <p>Vos circuits et vos preuves, au même endroit.</p>
        <form
          aria-busy={busy}
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
              disabled={busy}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <span className="password-input">
              <input
                id="auth-password"
                aria-label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-button password-toggle"
                aria-controls="auth-password"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                disabled={busy}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
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
              setPassword('');
              setShowPassword(false);
            }}
          >
            {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </section>
    </div>
  );
}
