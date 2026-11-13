// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Auth } from '../../../../src/features/auth/AuthDialog.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));

test('keyboard focus stays in the dialog and returns to its opener on close', async () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const view = render(<Auth mode="login" setMode={vi.fn()} onClose={vi.fn()} onDone={vi.fn()} />);
  const first = screen.getByRole('button', { name: 'Fermer', exact: true });
  const last = screen.getByRole('button', { name: 'Créer un compte' });
  first.focus();
  expect(first).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(last).toHaveFocus();
  await userEvent.tab();
  expect(first).toHaveFocus();
  view.unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});
test('auth submits credentials, displays failure and supports closing/switching', async () => {
  const done = vi.fn(),
    close = vi.fn(),
    mode = vi.fn();
  api.mockRejectedValueOnce(Error('Identifiants incorrects')).mockResolvedValueOnce({});
  render(<Auth mode="login" setMode={mode} onClose={close} onDone={done} />);
  await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'user@example.test');
  await userEvent.type(screen.getByLabelText(/Mot de passe/), 'long-password-123');
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants incorrects');
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  expect(done).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
  expect(mode).toHaveBeenCalledWith('register');
  await userEvent.keyboard('{Escape}');
  expect(close).toHaveBeenCalled();
});

test('password visibility never submits credentials and resets on mode switch', async () => {
  const mode = vi.fn();
  api.mockClear();
  render(<Auth mode="login" setMode={mode} onClose={vi.fn()} onDone={vi.fn()} />);
  const password = screen.getByLabelText('Mot de passe', { exact: true });
  expect(password).toHaveAttribute('type', 'password');
  expect(password).toHaveAttribute('autocomplete', 'current-password');
  await userEvent.type(password, 'my-private-password');
  await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(api).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
  expect(password).toHaveValue('my-private-password');
  expect(password).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
  expect(password).toHaveValue('');
});
