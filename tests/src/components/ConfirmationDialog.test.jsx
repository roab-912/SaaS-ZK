// @vitest-environment jsdom
import React, { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from '../../../src/components/ConfirmationDialog.jsx';
test('confirmation defaults to cancel and restores focus without mutation', async () => {
  const confirm = vi.fn();
  function Form() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Supprimer</button>
        {open && (
          <ConfirmationDialog
            title="Confirmer la suppression"
            onConfirm={confirm}
            onCancel={() => setOpen(false)}
          >
            Archive publique
          </ConfirmationDialog>
        )}
      </>
    );
  }
  render(<Form />);
  const trigger = screen.getByRole('button');
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Confirmer la suppression');
  expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(confirm).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});
test('failed actions stay open; pending actions cannot run twice or escape', async () => {
  let finish;
  const confirm = vi
      .fn()
      .mockRejectedValueOnce(Error('Réseau indisponible'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    cancel = vi.fn();
  render(
    <ConfirmationDialog title="Action sensible" onConfirm={confirm} onCancel={cancel}>
      Confirmation
    </ConfirmationDialog>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Réseau indisponible');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
  expect(screen.getByRole('button', { name: /Traitement/ })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(cancel).not.toHaveBeenCalled();
  finish();
  await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  expect(confirm).toHaveBeenCalledTimes(2);
});
