// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from '../../../src/components/CopyButton.jsx';
test('copies the full public value and announces success', async () => {
  const user = userEvent.setup(),
    write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<CopyButton value={'a'.repeat(64)} label="Copier l’empreinte" />);
  await user.click(screen.getByRole('button', { name: 'Copier l’empreinte' }));
  expect(write).toHaveBeenCalledWith('a'.repeat(64));
  expect(screen.getByRole('status')).toHaveTextContent('Copié');
});
test('clipboard denial gives a visible manual-copy fallback', async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(Error('denied'));
  render(<CopyButton value="public" />);
  await user.click(screen.getByRole('button'));
  expect(screen.getByRole('alert')).toHaveTextContent('Sélectionnez le texte');
});
