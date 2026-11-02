// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationProgress } from '../../../src/components/OperationProgress.jsx';
test('only measured document progress shows a percentage-equivalent counter', async () => {
  const cancel = vi.fn(),
    v = render(<OperationProgress message="Vérification" onCancel={cancel} />);
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('value');
  v.rerender(<OperationProgress message="Import UBL" completed={2} total={10} onCancel={cancel} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '10');
  expect(screen.getByRole('status')).toHaveTextContent('2 / 10 documents');
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(cancel).toHaveBeenCalledOnce();
  v.rerender(<OperationProgress completed={20} total={10} />);
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('value');
});

test('elapsed time updates independently of real stages and stops on unmount', () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  try {
    const view = render(<OperationProgress stage="prove" message="Calcul" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3');
    expect(screen.getByText('Création de la preuve')).toHaveAttribute('aria-current', 'step');
    now = 65000;
    act(() => {
      vi.advanceTimersByTime(65000);
    });
    expect(screen.getByLabelText('Temps écoulé')).toHaveTextContent('1 min 05 s');
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3');
    expect(screen.getByRole('status')).not.toHaveTextContent('Temps écoulé');
    view.rerender(<OperationProgress stage="verify" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4');
    expect(screen.getByLabelText('Temps écoulé')).toHaveTextContent('1 min 05 s');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
