// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Auth } from '../../../../src/features/auth/AuthDialog.jsx';
import { api } from '../../../../src/lib/api.js';
vi.mock('../../../../src/lib/api.js', () => ({ api: vi.fn() }));
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
