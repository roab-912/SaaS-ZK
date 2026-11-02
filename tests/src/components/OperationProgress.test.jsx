// @vitest-environment jsdom
import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
